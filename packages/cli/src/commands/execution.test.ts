import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import net from 'node:net';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, unlinkSync, existsSync } from 'fs';

import { startManagedServer } from '@autokestra/server';
import { Engine } from '@autokestra/engine';
import { createInitialExecution } from '@autokestra/engine/src/execution/models';
import { ExecutionState } from '@autokestra/engine/src/execution/types';

import { listExecutions, inspectExecution, getExecutionLogs, cleanupExecutions } from './execution';

describe('Execution Commands', () => {
  let dir = '';
  let testDbPath = '';
  let baseUrl = '';
  const apiKey = 'test-key';
  let shutdownServer: (() => Promise<void>) | undefined;

  async function getFreePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        server.close(() => resolve(port));
      });
    });
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-exec-'));
    testDbPath = join(dir, 'db.sqlite');
    if (existsSync(testDbPath)) unlinkSync(testDbPath);

    // Setup test data
    const engine = new Engine({ storage: { path: testDbPath } });
    await engine.initialize();
    const store = engine.getStateStore();
    const db = engine.getDatabase();

    // Create test workflow
    await store.saveWorkflow({
      id: 'test-wf',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test executions
    const exec1 = createInitialExecution('test-wf', 'exec-1');
    exec1.state = ExecutionState.SUCCESS;
    exec1.timestamps.endedAt = new Date();
    await store.createExecution(exec1);

    // Insert a log row for logs test
    db.prepare(
      `INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('exec-1', 't1', Date.now(), 'INFO', 'test', 'hello', JSON.stringify({ ok: true }));

    const exec2 = createInitialExecution('test-wf', 'exec-2');
    exec2.state = ExecutionState.RUNNING;
    await store.createExecution(exec2);

    // Create an old execution for cleanup testing
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

    const oldExec = createInitialExecution('test-wf', 'old-exec');
    oldExec.state = ExecutionState.SUCCESS;
    oldExec.timestamps.createdAt = oldDate;
    oldExec.timestamps.endedAt = oldDate;
    await store.createExecution(oldExec);

    await engine.shutdown();

    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    const previousDisable = process.env.AUTOKESTRA_DISABLE_RUNTIME;
    process.env.AUTOKESTRA_DISABLE_RUNTIME = '1';

    const managed = await startManagedServer({
      config: {
        server: { port, host: '127.0.0.1', apiKeys: [apiKey] },
        storage: { type: 'sqlite', path: testDbPath, retentionDays: 30 },
        execution: { maxConcurrentWorkflows: 1, maxConcurrentTasks: 1, defaultTimeoutSeconds: 60 },
      },
      silent: true,
      handleSignals: false,
    });

    shutdownServer = async () => {
      await managed.shutdown('test');
      process.env.AUTOKESTRA_DISABLE_RUNTIME = previousDisable;
    };
  });

  afterEach(async () => {
    await shutdownServer?.();
    shutdownServer = undefined;
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  describe('listExecutions', () => {
    it('should list all executions', async () => {
      // Capture console output
      const originalLog = console.log;
      let output = '';
      console.log = (msg: string) => {
        output += msg + '\n';
      };

      try {
        await listExecutions({ api: { baseUrl, apiKey } }, {});
        expect(output).toContain('exec-1');
        expect(output).toContain('exec-2');
      } finally {
        console.log = originalLog;
      }
    });

    it('should filter executions by workflow', async () => {
      const originalLog = console.log;
      let output = '';
      console.log = (msg: string) => {
        output += msg + '\n';
      };

      try {
        await listExecutions({ api: { baseUrl, apiKey } }, { workflowId: 'test-wf' });
        expect(output).toContain('exec-1');
        expect(output).toContain('test-wf');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('inspectExecution', () => {
    it('should inspect an execution', async () => {
      const originalLog = console.log;
      let output = '';
      console.log = (msg: string) => {
        output += msg + '\n';
      };

      try {
        await inspectExecution({ api: { baseUrl, apiKey } }, 'exec-1', {});
        expect(output).toContain('exec-1');
        expect(output).toContain('test-wf');
        expect(output).toContain('SUCCESS');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('getExecutionLogs', () => {
    it('should get execution logs', async () => {
      const originalLog = console.log;
      let output = '';
      console.log = (msg: string) => {
        output += msg + '\n';
      };

      try {
        await getExecutionLogs({ api: { baseUrl, apiKey } }, 'exec-1', {});
        expect(output).toContain('hello');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('cleanupExecutions', () => {
    it('should cleanup old executions in dry-run mode', async () => {
      const originalLog = console.log;
      let output = '';
      console.log = (msg: string) => {
        output += msg + '\n';
      };

      try {
        await cleanupExecutions({ api: { baseUrl, apiKey } }, { days: 30, dryRun: true });
        expect(output).toContain('Would delete');
      } finally {
        console.log = originalLog;
      }
    });

    it('should cleanup old executions', async () => {
      const originalLog = console.log;
      let output = '';
      console.log = (msg: string) => {
        output += msg + '\n';
      };

      try {
        await cleanupExecutions({ api: { baseUrl, apiKey } }, { days: 30 });
        expect(output).toContain('Deleted');
      } finally {
        console.log = originalLog;
      }

      // Verify via API the old execution was deleted
      const list = await fetch(`${baseUrl}/api/v1/executions?limit=200&offset=0`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(list.status).toBe(200);
      const body: any = await list.json();
      expect(body.executions.some((e: any) => e.executionId === 'old-exec')).toBe(false);
    });
  });
});
