import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SQLiteStateStore } from './sqlite';
import { CrashRecovery } from './recovery';
import { createInitialExecution, createInitialTaskRun } from '../execution/models';
import { ExecutionState, TaskRunState } from '../execution/types';
import { unlinkSync, existsSync } from 'fs';

describe('CrashRecovery', () => {
  const testDbPath = './test-crash-recovery.db';
  let store: SQLiteStateStore;
  let recovery: CrashRecovery;

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();
    recovery = new CrashRecovery(store);
  });

  afterEach(async () => {
    await store.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  const createTestWorkflow = async (id: string) => {
    await store.saveWorkflow({
      id,
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  it('should transition RUNNING executions to FAILED', async () => {
    await createTestWorkflow('wf1');
    const exec = createInitialExecution('wf1', 'exec1');
    exec.state = ExecutionState.RUNNING;
    exec.timestamps.startedAt = new Date();
    await store.createExecution(exec);

    const stats = await recovery.recover();

    expect(stats.failedExecutions).toBe(1);

    const recovered = await store.getExecution('exec1');
    expect(recovered?.state).toBe(ExecutionState.FAILED);
    expect(recovered?.reasonCode).toBe('CRASH_RECOVERY');
  });

  it('should transition RUNNING task runs to FAILED', async () => {
    await createTestWorkflow('wf1');
    const exec = createInitialExecution('wf1', 'exec1');
    exec.state = ExecutionState.RUNNING;
    await store.createExecution(exec);

    const taskRun = createInitialTaskRun('exec1', 'task1');
    taskRun.state = TaskRunState.RUNNING;
    await store.createTaskRun(taskRun);

    const stats = await recovery.recover();

    expect(stats.failedTaskRuns).toBe(1);

    const recovered = await store.getTaskRun('exec1', 'task1');
    expect(recovered?.state).toBe(TaskRunState.FAILED);
    expect(recovered?.reasonCode).toBe('CRASH_RECOVERY');
  });

  it('should identify PENDING executions for re-queueing', async () => {
    await createTestWorkflow('wf1');
    const exec1 = createInitialExecution('wf1', 'exec1');
    await store.createExecution(exec1);

    const exec2 = createInitialExecution('wf1', 'exec2');
    exec2.state = ExecutionState.WAITING;
    await store.createExecution(exec2);

    const stats = await recovery.recover();

    expect(stats.requeuedExecutions).toBe(2);
  });

  it('should not affect terminal state executions', async () => {
    await createTestWorkflow('wf1');
    const exec1 = createInitialExecution('wf1', 'exec1');
    exec1.state = ExecutionState.SUCCESS;
    await store.createExecution(exec1);

    const exec2 = createInitialExecution('wf1', 'exec2');
    exec2.state = ExecutionState.FAILED;
    await store.createExecution(exec2);

    const stats = await recovery.recover();

    expect(stats.failedExecutions).toBe(0);

    const retrieved1 = await store.getExecution('exec1');
    const retrieved2 = await store.getExecution('exec2');

    expect(retrieved1?.state).toBe(ExecutionState.SUCCESS);
    expect(retrieved2?.state).toBe(ExecutionState.FAILED);
  });

  it('should be idempotent', async () => {
    await createTestWorkflow('wf1');
    const exec = createInitialExecution('wf1', 'exec1');
    exec.state = ExecutionState.RUNNING;
    await store.createExecution(exec);

    const stats1 = await recovery.recover();
    expect(stats1.failedExecutions).toBe(1);

    // Run recovery again
    const stats2 = await recovery.recover();
    expect(stats2.failedExecutions).toBe(0); // No more RUNNING executions

    const recovered = await store.getExecution('exec1');
    expect(recovered?.state).toBe(ExecutionState.FAILED);
  });

  it('should provide recovery statistics', async () => {
    await createTestWorkflow('wf1');
    // Create various execution states
    for (let i = 0; i < 3; i++) {
      const exec = createInitialExecution('wf1', `running-${i}`);
      exec.state = ExecutionState.RUNNING;
      await store.createExecution(exec);
    }

    for (let i = 0; i < 2; i++) {
      const exec = createInitialExecution('wf1', `pending-${i}`);
      await store.createExecution(exec);
    }

    const stats = await recovery.recover();

    expect(stats.failedExecutions).toBe(3);
    expect(stats.requeuedExecutions).toBe(2);
    expect(stats.duration).toBeGreaterThan(0);
  });
});
