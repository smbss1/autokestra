import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PersistentScheduler } from './persistent';
import { SQLiteStateStore } from '../storage/sqlite';
import { ExecutionState } from '../execution/types';
import { unlinkSync, existsSync } from 'fs';

describe('PersistentScheduler', () => {
  const testDbPath = './test-persistent-scheduler.db';
  let store: SQLiteStateStore;
  let scheduler: PersistentScheduler;

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();

    // Create a test workflow
    await store.saveWorkflow({
      id: 'wf1',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    scheduler = new PersistentScheduler({ stateStore: store });
  });

  afterEach(async () => {
    await store.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should create and persist an execution', async () => {
    const execution = await scheduler.createExecution('wf1', 'exec1');

    expect(execution.executionId).toBe('exec1');
    expect(execution.workflowId).toBe('wf1');
    expect(execution.state).toBe(ExecutionState.PENDING);

    const retrieved = await store.getExecution('exec1');
    expect(retrieved?.executionId).toBe('exec1');
  });

  it('should start an execution', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');

    const execution = await store.getExecution('exec1');
    expect(execution?.state).toBe(ExecutionState.RUNNING);
    expect(execution?.timestamps.startedAt).toBeDefined();
  });

  it('should complete an execution', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');
    await scheduler.completeExecution('exec1', ExecutionState.SUCCESS);

    const execution = await store.getExecution('exec1');
    expect(execution?.state).toBe(ExecutionState.SUCCESS);
    expect(execution?.timestamps.endedAt).toBeDefined();
  });

  it('should get active executions', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');

    await scheduler.createExecution('wf1', 'exec2');
    await scheduler.startExecution('exec2');

    await scheduler.createExecution('wf1', 'exec3');

    const active = await scheduler.getActiveExecutions();
    expect(active.length).toBe(2);
    expect(active.map(e => e.executionId)).toContain('exec1');
    expect(active.map(e => e.executionId)).toContain('exec2');
  });

  it('should get pending executions', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.createExecution('wf1', 'exec2');
    await scheduler.startExecution('exec2');

    const pending = await scheduler.getPendingExecutions();
    expect(pending.length).toBe(1);
    expect(pending[0].executionId).toBe('exec1');
  });

  it('should throw error when starting non-existent execution', async () => {
    await expect(scheduler.startExecution('nonexistent')).rejects.toThrow('not found');
  });

  it('should throw error when starting non-pending execution', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');

    await expect(scheduler.startExecution('exec1')).rejects.toThrow('Cannot start');
  });

  it('should cancel an execution and emit audit events', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');
    await scheduler.cancelExecution('exec1', 'USER_REQUEST');

    const execution = await store.getExecution('exec1');
    expect(execution?.state).toBe(ExecutionState.CANCELLED);
    expect(execution?.reasonCode).toBe('USER_REQUEST');
    expect(execution?.timestamps.endedAt).toBeDefined();
  });

  it('should handle cancellation idempotently', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');
    await scheduler.cancelExecution('exec1', 'USER_REQUEST');
    await scheduler.cancelExecution('exec1', 'USER_REQUEST'); // Should not error

    const execution = await store.getExecution('exec1');
    expect(execution?.state).toBe(ExecutionState.CANCELLED);
  });

  it('should timeout an execution and emit audit events', async () => {
    await scheduler.createExecution('wf1', 'exec1');
    await scheduler.startExecution('exec1');
    await scheduler.timeoutExecution('exec1', 30000);

    const execution = await store.getExecution('exec1');
    expect(execution?.state).toBe(ExecutionState.FAILED);
    expect(execution?.reasonCode).toBe('TIMEOUT');
    expect(execution?.message).toContain('timed out after 30000ms');
  });
});
