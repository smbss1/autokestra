import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { listExecutions, inspectExecution, getExecutionLogs, cleanupExecutions } from './execution';
import { Engine } from '@autokestra/engine';
import { createInitialExecution } from '@autokestra/engine/src/execution/models';
import { ExecutionState } from '@autokestra/engine/src/execution/types';
import { unlinkSync, existsSync } from 'fs';

describe('Execution Commands', () => {
  const testDbPath = './test-cli-executions.db';

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Setup test data
    const engine = new Engine({ storage: { path: testDbPath } });
    await engine.initialize();
    const store = engine.getStateStore();

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
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
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
        await listExecutions({ dbPath: testDbPath }, {});
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
        await listExecutions({ dbPath: testDbPath }, { workflowId: 'test-wf' });
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
        await inspectExecution({ dbPath: testDbPath }, 'exec-1', {});
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
        await getExecutionLogs({ dbPath: testDbPath }, 'exec-1', {});
        expect(output).toContain('exec-1');
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
        await cleanupExecutions({ dbPath: testDbPath }, { days: 30, dryRun: true });
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
        await cleanupExecutions({ dbPath: testDbPath }, { days: 30 });
        expect(output).toContain('Deleted');
      } finally {
        console.log = originalLog;
      }

      // Verify the old execution was deleted
      const engine = new Engine({ storage: { path: testDbPath } });
      await engine.initialize();
      const store = engine.getStateStore();
      const executions = await store.listExecutions();
      expect(executions.total).toBe(2); // Should have exec-1 and exec-2, old-exec deleted
      await engine.shutdown();
    });
  });
});
