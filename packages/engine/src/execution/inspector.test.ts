import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { SQLiteStateStore } from '../storage/sqlite';
import { MigrationRunner } from '../storage/migrations/runner';
import { ExecutionInspector } from './inspector';
import { LogStore } from './logging/store';
import { LogCollector, LogLevel } from './logging/collector';
import { AuditLogger } from './logging/audit';
import { ExecutionState, TaskRunState } from './types';
import { createInitialExecution, createInitialTaskRun } from './models';
import { unlinkSync, existsSync } from 'fs';

describe('ExecutionInspector', () => {
  const testDbPath = './test-inspector.db';
  let db: Database;
  let store: SQLiteStateStore;
  let logStore: LogStore;
  let logCollector: LogCollector;
  let auditLogger: AuditLogger;

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    const migrationRunner = new MigrationRunner(testDbPath);
    await migrationRunner.runPendingMigrations(db);

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();

    logStore = new LogStore({ db });
    logCollector = new LogCollector({ db, maxBufferSize: 5, flushIntervalMs: 100 });
    auditLogger = new AuditLogger({ db });

    await store.saveWorkflow({
      id: 'wf-1',
      definition: {
        tasks: [
          { id: 'task-1', type: 'plugin/ns.action', needs: [] },
          { id: 'task-2', type: 'builtin.task', needs: ['task-1'] },
        ],
        triggers: [],
      },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    logCollector.close();
    await store.close();
    db.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should return overview, tasks, inputs/outputs, timeline, and audit trail', async () => {
    const executionId = 'exec-1';
    const execution = createInitialExecution('wf-1', executionId);
    execution.state = ExecutionState.RUNNING;
    execution.timestamps.startedAt = new Date(Date.now() - 2000);
    execution.metadata = { apiKey: 'super-secret', nested: { token: 'also-secret' }, safe: 'ok' };
    await store.createExecution(execution);

    const task1 = createInitialTaskRun(executionId, 'task-1');
    task1.state = TaskRunState.SUCCESS;
    task1.timestamps.startedAt = new Date(Date.now() - 1500);
    task1.timestamps.endedAt = new Date(Date.now() - 1000);
    task1.inputs = { apiKey: 'secret', value: 'ok' };
    task1.outputs = { token: 'secret-token', result: 'done' };
    task1.durationMs = 500;
    await store.createTaskRun(task1);

    const task2 = createInitialTaskRun(executionId, 'task-2');
    task2.state = TaskRunState.RUNNING;
    task2.timestamps.startedAt = new Date(Date.now() - 800);
    await store.createTaskRun(task2);

    logCollector.log({
      executionId,
      taskId: 'task-1',
      timestamp: Date.now(),
      level: LogLevel.WARN,
      source: 'worker',
      message: 'Task retry attempt 2',
      metadata: { attempt: 2, reason: 'network error' },
    });
    logCollector.flush();

    auditLogger.emitCreated(executionId, 'wf-1');

    const inspector = new ExecutionInspector(store, logStore);

    const overview = await inspector.getExecutionOverview(executionId);
    expect(overview?.executionId).toBe(executionId);
    expect(overview?.workflowId).toBe('wf-1');
    expect((overview as any)?.metadata?.apiKey).toBe('***MASKED***');
    expect((overview as any)?.metadata?.nested?.token).toBe('***MASKED***');
    expect((overview as any)?.metadata?.safe).toBe('ok');

    const tasks = await inspector.getTaskDetails(executionId);
    expect(tasks.length).toBe(2);
    const task1Detail = tasks.find(t => t.taskId === 'task-1');
    expect(task1Detail?.type).toBe('plugin/ns.action');
    expect(task1Detail?.attemptCount).toBe(2);
    expect(task1Detail?.retryReasons?.[0]?.reason).toBe('network error');

    const inputsOutputs = await inspector.getTaskInputsOutputs(executionId);
    const task1IO = inputsOutputs.find(io => io.taskId === 'task-1');
    expect(task1IO?.inputs?.apiKey).toBe('***MASKED***');
    expect(task1IO?.outputs?.token).toBe('***MASKED***');

    const timeline = await inspector.getTimeline(executionId);
    expect(timeline.length).toBeGreaterThan(0);

    const auditTrail = inspector.getAuditTrail(executionId);
    expect(auditTrail.length).toBeGreaterThan(0);
  });
});
