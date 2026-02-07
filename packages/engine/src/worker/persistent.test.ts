import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PersistentTaskExecutor } from './persistent';
import { SQLiteStateStore } from '../storage/sqlite';
import { TaskRunState } from '../execution/types';
import { createInitialExecution } from '../execution/models';
import { unlinkSync, existsSync } from 'fs';

describe('PersistentTaskExecutor', () => {
  const testDbPath = './test-persistent-executor.db';
  let store: SQLiteStateStore;
  let executor: PersistentTaskExecutor;

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();

    // Create a test workflow and execution
    await store.saveWorkflow({
      id: 'wf1',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const execution = createInitialExecution('wf1', 'exec1');
    await store.createExecution(execution);

    executor = new PersistentTaskExecutor({ stateStore: store });
  });

  afterEach(async () => {
    await store.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should create and persist a task run', async () => {
    const taskRun = await executor.createTaskRun('exec1', 'task1');

    expect(taskRun.executionId).toBe('exec1');
    expect(taskRun.taskId).toBe('task1');
    expect(taskRun.state).toBe(TaskRunState.PENDING);

    const retrieved = await store.getTaskRun('exec1', 'task1');
    expect(retrieved?.taskId).toBe('task1');
  });

  it('should start a task run', async () => {
    await executor.createTaskRun('exec1', 'task1');
    await executor.startTaskRun('exec1', 'task1');

    const taskRun = await store.getTaskRun('exec1', 'task1');
    expect(taskRun?.state).toBe(TaskRunState.RUNNING);
    expect(taskRun?.timestamps.startedAt).toBeDefined();
  });

  it('should complete a task run', async () => {
    await executor.createTaskRun('exec1', 'task1');
    await executor.startTaskRun('exec1', 'task1');
    await executor.completeTaskRun('exec1', 'task1', TaskRunState.SUCCESS);

    const taskRun = await store.getTaskRun('exec1', 'task1');
    expect(taskRun?.state).toBe(TaskRunState.SUCCESS);
    expect(taskRun?.timestamps.endedAt).toBeDefined();
  });

  it('should complete a task run with error message', async () => {
    await executor.createTaskRun('exec1', 'task1');
    await executor.startTaskRun('exec1', 'task1');
    await executor.completeTaskRun('exec1', 'task1', TaskRunState.FAILED, 'Task failed');

    const taskRun = await store.getTaskRun('exec1', 'task1');
    expect(taskRun?.state).toBe(TaskRunState.FAILED);
    expect(taskRun?.message).toBe('Task failed');
  });

  it('should create an attempt', async () => {
    await executor.createTaskRun('exec1', 'task1');
    await executor.createAttempt('exec1', 'task1', 1);

    const attempts = await store.getAttempts('exec1:task1');
    expect(attempts.length).toBe(1);
    expect(attempts[0].attemptNumber).toBe(1);
  });

  it('should get all task runs for an execution', async () => {
    await executor.createTaskRun('exec1', 'task1');
    await executor.createTaskRun('exec1', 'task2');
    await executor.createTaskRun('exec1', 'task3');

    const taskRuns = await executor.getTaskRuns('exec1');
    expect(taskRuns.length).toBe(3);
  });

  it('should get a specific task run', async () => {
    await executor.createTaskRun('exec1', 'task1');

    const taskRun = await executor.getTaskRun('exec1', 'task1');
    expect(taskRun?.taskId).toBe('task1');
  });

  it('should throw error when starting non-existent task run', async () => {
    await expect(executor.startTaskRun('exec1', 'nonexistent')).rejects.toThrow('not found');
  });

  it('should throw error when starting non-pending task run', async () => {
    await executor.createTaskRun('exec1', 'task1');
    await executor.startTaskRun('exec1', 'task1');

    await expect(executor.startTaskRun('exec1', 'task1')).rejects.toThrow('Cannot start');
  });
});
