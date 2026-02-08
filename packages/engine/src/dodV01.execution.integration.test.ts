import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync, existsSync } from 'fs';

import { SQLiteStateStore } from './storage/sqlite';
import { PersistentScheduler } from './scheduler/persistent';
import { LogCollector } from './execution/logging/collector';
import { AuditLogger } from './execution/logging/audit';
import { LogMetricsTracker } from './execution/logging/metrics';
import { ExecutionState } from './execution/types';

import { MigrationRunner } from './storage/migrations/runner';

// Keep it small and deterministic.
const testDbPath = './test-dod-v01-exec.db';

describe('DoD v0.1 - Execution reaches terminal state (SQLite)', () => {
  let db: Database;
  let store: SQLiteStateStore;
  let scheduler: PersistentScheduler;
  let logCollector: LogCollector;
  let auditLogger: AuditLogger;
  let logMetricsTracker: LogMetricsTracker;

  beforeEach(async () => {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);

    db = new Database(testDbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    const runner = new MigrationRunner(testDbPath);
    await runner.runPendingMigrations(db);

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();

    await store.saveWorkflow({
      id: 'wf-dod',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logCollector = new LogCollector({ db, maxBufferSize: 10, flushIntervalMs: 50 });
    auditLogger = new AuditLogger({ db });
    logMetricsTracker = new LogMetricsTracker(db);

    scheduler = new PersistentScheduler({
      stateStore: store,
      logCollector,
      auditLogger,
      logMetricsTracker,
    });
  });

  afterEach(async () => {
    logCollector.close();
    await store.close();
    db.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  it('2.3 creates, starts, and completes an execution to SUCCESS', async () => {
    const executionId = 'exec-dod-terminal';

    const created = await scheduler.createExecution('wf-dod', executionId);
    expect(created.state).toBe(ExecutionState.PENDING);

    await scheduler.startExecution(executionId);
    expect((await store.getExecution(executionId))?.state).toBe(ExecutionState.RUNNING);

    await scheduler.completeExecution(executionId, ExecutionState.SUCCESS);
    expect((await store.getExecution(executionId))?.state).toBe(ExecutionState.SUCCESS);
  });
});
