import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SQLiteStateStore } from './sqlite';
import { createInitialExecution, createInitialTaskRun } from '../execution/models';
import { ExecutionState, TaskRunState } from '../execution/types';
import { unlinkSync, existsSync } from 'fs';

describe('SQLiteStateStore', () => {
  const testDbPath = './test-state-store.db';
  let store: SQLiteStateStore;

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  // Helper to create a test workflow
  const createTestWorkflow = async (id: string) => {
    await store.saveWorkflow({
      id,
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  describe('Workflow CRUD', () => {
    it('should save and retrieve a workflow', async () => {
      const workflow = {
        id: 'test-workflow',
        definition: { tasks: [], triggers: [] },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.saveWorkflow(workflow);

      const retrieved = await store.getWorkflow('test-workflow');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test-workflow');
      expect(retrieved?.enabled).toBe(true);
    });

    it('should update an existing workflow', async () => {
      const workflow = {
        id: 'test-workflow',
        definition: { tasks: [] },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.saveWorkflow(workflow);

      // Update
      workflow.enabled = false;
      workflow.updatedAt = new Date();
      await store.saveWorkflow(workflow);

      const retrieved = await store.getWorkflow('test-workflow');
      expect(retrieved?.enabled).toBe(false);
    });

    it('should list workflows with pagination', async () => {
      // Create multiple workflows
      for (let i = 0; i < 5; i++) {
        await store.saveWorkflow({
          id: `workflow-${i}`,
          definition: {},
          enabled: i % 2 === 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const result = await store.listWorkflows({ limit: 3, offset: 0 });
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(5);

      const filtered = await store.listWorkflows({ enabled: true });
      expect(filtered.items.length).toBe(3); // 0, 2, 4
    });

    it('should delete a workflow', async () => {
      const workflow = {
        id: 'test-workflow',
        definition: {},
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.saveWorkflow(workflow);
      await store.deleteWorkflow('test-workflow');

      const retrieved = await store.getWorkflow('test-workflow');
      expect(retrieved).toBeNull();
    });
  });

  describe('Execution CRUD', () => {
    it('should create and retrieve an execution', async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec1');

      await store.createExecution(execution);

      const retrieved = await store.getExecution('exec1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.executionId).toBe('exec1');
      expect(retrieved?.workflowId).toBe('wf1');
      expect(retrieved?.state).toBe(ExecutionState.PENDING);
    });

    it('should update execution state', async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec1');
      await store.createExecution(execution);

      execution.state = ExecutionState.RUNNING;
      execution.timestamps.startedAt = new Date();
      execution.timestamps.updatedAt = new Date();
      execution.logEntryCount = 5;

      await store.updateExecution(execution);

      const retrieved = await store.getExecution('exec1');
      expect(retrieved?.state).toBe(ExecutionState.RUNNING);
      expect(retrieved?.timestamps.startedAt).not.toBeUndefined();
      expect(retrieved?.logEntryCount).toBe(5);
    });

    it('should list executions with filters', async () => {
      await createTestWorkflow('wf1');
      // Create multiple executions
      for (let i = 0; i < 5; i++) {
        const exec = createInitialExecution('wf1', `exec${i}`);
        if (i >= 3) {
          exec.state = ExecutionState.RUNNING;
        }
        await store.createExecution(exec);
      }

      const allResults = await store.listExecutions();
      expect(allResults.total).toBe(5);

      const runningResults = await store.listExecutions({ state: ExecutionState.RUNNING });
      expect(runningResults.items.length).toBe(2);

      const workflow1Results = await store.listExecutions({ workflowId: 'wf1' });
      expect(workflow1Results.total).toBe(5);
    });

    it('should filter executions by date range', async () => {
      await createTestWorkflow('wf1');
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const exec1 = createInitialExecution('wf1', 'exec1');
      exec1.timestamps.createdAt = yesterday;
      await store.createExecution(exec1);

      const exec2 = createInitialExecution('wf1', 'exec2');
      await store.createExecution(exec2);

      const results = await store.listExecutions({ createdAfter: now });
      expect(results.items.length).toBe(1);
      expect(results.items[0].executionId).toBe('exec2');
    });
  });

  describe('TaskRun CRUD', () => {
    beforeEach(async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec1');
      await store.createExecution(execution);
    });

    it('should create and retrieve a task run', async () => {
      const taskRun = createInitialTaskRun('exec1', 'task1');

      await store.createTaskRun(taskRun);

      const retrieved = await store.getTaskRun('exec1', 'task1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.taskId).toBe('task1');
      expect(retrieved?.state).toBe(TaskRunState.PENDING);
    });

    it('should update task run state', async () => {
      const taskRun = createInitialTaskRun('exec1', 'task1');
      await store.createTaskRun(taskRun);

      taskRun.state = TaskRunState.RUNNING;
      taskRun.timestamps.startedAt = new Date();
      taskRun.timestamps.updatedAt = new Date();

      await store.updateTaskRun(taskRun);

      expect(retrieved?.state).toBe(TaskRunState.RUNNING);
    });

    it('should list task runs for an execution', async () => {
      await store.createTaskRun(createInitialTaskRun('exec1', 'task1'));
      await store.createTaskRun(createInitialTaskRun('exec1', 'task2'));
      expect(retrieved?.logEntryCount).toBe(5);
      await store.createTaskRun(createInitialTaskRun('exec1', 'task3'));

      const results = await store.listTaskRuns({ executionId: 'exec1' });
      expect(results.items.length).toBe(3);
    });
  });

  describe('Attempt tracking', () => {
    beforeEach(async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec1');
      await store.createExecution(execution);

      const taskRun = createInitialTaskRun('exec1', 'task1');
      await store.createTaskRun(taskRun);
    });

    it('should create and retrieve attempts', async () => {
      const attempt1 = {
        taskRunId: 'exec1:task1',
        attemptNumber: 1,
        status: 'SUCCESS' as const,
        timestamps: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      await store.createAttempt(attempt1);

      const attempts = await store.getAttempts('exec1:task1');
      expect(attempts.length).toBe(1);
      expect(attempts[0].attemptNumber).toBe(1);
    });

    it('should track multiple attempts in order', async () => {
      for (let i = 1; i <= 3; i++) {
        await store.createAttempt({
          taskRunId: 'exec1:task1',
          attemptNumber: i,
          timestamps: {

    it('should persist task run debug fields', async () => {
      const taskRun = createInitialTaskRun('exec1', 'task1');
      taskRun.inputs = { apiKey: '***MASKED***', value: 'ok' };
      taskRun.outputs = { result: 'success' };
      taskRun.error = { message: 'none' };
      taskRun.durationMs = 1234;
      taskRun.metadata = { taskType: 'test' };

      await store.createTaskRun(taskRun);

      const retrieved = await store.getTaskRun('exec1', 'task1');
      expect(retrieved?.inputs).toEqual({ apiKey: '***MASKED***', value: 'ok' });
      expect(retrieved?.outputs).toEqual({ result: 'success' });
      expect(retrieved?.error).toEqual({ message: 'none' });
      expect(retrieved?.durationMs).toBe(1234);
      expect(retrieved?.metadata).toEqual({ taskType: 'test' });
    });
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      const attempts = await store.getAttempts('exec1:task1');
      expect(attempts.length).toBe(3);
      expect(attempts[0].attemptNumber).toBe(1);
      expect(attempts[2].attemptNumber).toBe(3);
    });
  });

  describe('Transactions', () => {
    it('should commit successful transactions', async () => {
      await createTestWorkflow('wf1');
      await store.transaction(async () => {
        const execution = createInitialExecution('wf1', 'exec1');
        await store.createExecution(execution);

        const taskRun = createInitialTaskRun('exec1', 'task1');
        await store.createTaskRun(taskRun);
      });

      const execution = await store.getExecution('exec1');
      const taskRun = await store.getTaskRun('exec1', 'task1');

      expect(execution).not.toBeNull();
      expect(taskRun).not.toBeNull();
    });

    it('should rollback failed transactions', async () => {
      await createTestWorkflow('wf1');
      try {
        await store.transaction(async () => {
          const execution = createInitialExecution('wf1', 'exec1');
          await store.createExecution(execution);

          throw new Error('Intentional error');
        });
      } catch (error) {
        // Expected
      }

      const execution = await store.getExecution('exec1');
      expect(execution).toBeNull();
    });
  });

  describe('Atomic batch operations', () => {
    it('should update execution and task runs atomically', async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec-batch');
      await store.createExecution(execution);

      // Create some task runs
      const taskRun1 = createInitialTaskRun('exec-batch', 'task1');
      const taskRun2 = createInitialTaskRun('exec-batch', 'task2');
      await store.createTaskRun(taskRun1);
      await store.createTaskRun(taskRun2);

      // Update execution and task runs atomically
      execution.state = ExecutionState.RUNNING;
      execution.timestamps.startedAt = new Date();
      execution.timestamps.updatedAt = new Date();

      taskRun1.state = TaskRunState.RUNNING;
      taskRun1.timestamps.startedAt = new Date();
      taskRun1.timestamps.updatedAt = new Date();

      taskRun2.state = TaskRunState.SUCCESS;
      taskRun2.timestamps.startedAt = new Date();
      taskRun2.timestamps.endedAt = new Date();
      taskRun2.timestamps.updatedAt = new Date();

      await store.updateExecutionAndTaskRuns(execution, [taskRun1, taskRun2]);

      // Verify all updates were applied
      const updatedExecution = await store.getExecution('exec-batch');
      expect(updatedExecution?.state).toBe(ExecutionState.RUNNING);

      const updatedTaskRun1 = await store.getTaskRun('exec-batch', 'task1');
      expect(updatedTaskRun1?.state).toBe(TaskRunState.RUNNING);

      const updatedTaskRun2 = await store.getTaskRun('exec-batch', 'task2');
      expect(updatedTaskRun2?.state).toBe(TaskRunState.SUCCESS);
    });

    it('should rollback execution and task run updates on failure', async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec-batch-fail');
      await store.createExecution(execution);

      const taskRun = createInitialTaskRun('exec-batch-fail', 'task1');
      await store.createTaskRun(taskRun);

      // Try to update with invalid data that should cause rollback
      execution.state = ExecutionState.RUNNING;
      taskRun.state = TaskRunState.RUNNING;

      try {
        await store.transaction(async () => {
          await store.updateExecutionAndTaskRuns(execution, [taskRun]);
          throw new Error('Intentional rollback');
        });
      } catch (error) {
        // Expected
      }

      // Verify nothing was updated
      const retrievedExecution = await store.getExecution('exec-batch-fail');
      expect(retrievedExecution?.state).toBe(ExecutionState.PENDING);

      const retrievedTaskRun = await store.getTaskRun('exec-batch-fail', 'task1');
      expect(retrievedTaskRun?.state).toBe(TaskRunState.PENDING);
    });
  });

  describe('Recovery queries', () => {
    it('should find active (RUNNING) executions', async () => {
      await createTestWorkflow('wf1');
      const exec1 = createInitialExecution('wf1', 'exec1');
      exec1.state = ExecutionState.RUNNING;
      await store.createExecution(exec1);

      const exec2 = createInitialExecution('wf1', 'exec2');
      exec2.state = ExecutionState.SUCCESS;
      await store.createExecution(exec2);

      const active = await store.getActiveExecutions();
      expect(active.length).toBe(1);
      expect(active[0].executionId).toBe('exec1');
    });

    it('should find pending executions', async () => {
      await createTestWorkflow('wf1');
      const exec1 = createInitialExecution('wf1', 'exec1');
      await store.createExecution(exec1);

      const exec2 = createInitialExecution('wf1', 'exec2');
      exec2.state = ExecutionState.WAITING;
      await store.createExecution(exec2);

      const exec3 = createInitialExecution('wf1', 'exec3');
      exec3.state = ExecutionState.SUCCESS;
      await store.createExecution(exec3);

      const pending = await store.getPendingExecutions();
      expect(pending.length).toBe(2);
    });
  });

  describe('Retention', () => {
    it('should delete old executions', async () => {
      await createTestWorkflow('wf1');
      const now = new Date();
      const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

      const exec1 = createInitialExecution('wf1', 'exec1');
      exec1.timestamps.createdAt = old;
      exec1.state = ExecutionState.SUCCESS;
      await store.createExecution(exec1);

      const exec2 = createInitialExecution('wf1', 'exec2');
      exec2.state = ExecutionState.SUCCESS;
      await store.createExecution(exec2);

      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const deleted = await store.deleteExecutionsBefore(cutoff, [ExecutionState.SUCCESS]);

      expect(deleted).toBe(1);

      const remaining = await store.listExecutions();
      expect(remaining.total).toBe(1);
      expect(remaining.items[0].executionId).toBe('exec2');
    });

    it('should cascade delete task runs and attempts', async () => {
      await createTestWorkflow('wf1');
      const execution = createInitialExecution('wf1', 'exec1');
      execution.state = ExecutionState.SUCCESS;
      await store.createExecution(execution);

      const taskRun = createInitialTaskRun('exec1', 'task1');
      await store.createTaskRun(taskRun);

      await store.createAttempt({
        taskRunId: 'exec1:task1',
        attemptNumber: 1,
        timestamps: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const cutoff = new Date();
      await store.deleteExecutionsBefore(cutoff, [ExecutionState.SUCCESS]);

    });
  });

  describe('Performance benchmarks', () => {
    const perfDbPath = './perf-test-state-store.db';

    beforeEach(async () => {
      // Clean up any existing perf database
      if (existsSync(perfDbPath)) {
        unlinkSync(perfDbPath);
      }

      store = new SQLiteStateStore({ path: perfDbPath });
      await store.initialize();
    });

    afterEach(async () => {
      await store.close();
      if (existsSync(perfDbPath)) {
        unlinkSync(perfDbPath);
      }
    });

    it('should handle 1000+ executions with acceptable query performance', async () => {
      // Create test workflow
      await store.saveWorkflow({
        id: 'perf-workflow',
        definition: { tasks: [], triggers: [] },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const numExecutions = 1000;
      const startTime = performance.now();

      // Create 1000 executions
      for (let i = 0; i < numExecutions; i++) {
        const execution = createInitialExecution('perf-workflow', `exec-${i}`);
        // Vary states for realistic distribution
        if (i % 10 === 0) {
          execution.state = ExecutionState.RUNNING;
        } else if (i % 5 === 0) {
          execution.state = ExecutionState.SUCCESS;
        } else if (i % 3 === 0) {
          execution.state = ExecutionState.FAILED;
        }
        await store.createExecution(execution);
      }

      const createTime = performance.now() - startTime;
      console.log(`Created ${numExecutions} executions in ${createTime.toFixed(2)}ms`);

      // Benchmark list all executions
      const listStart = performance.now();
      const allResults = await store.listExecutions();
      const listTime = performance.now() - listStart;
      console.log(`Listed ${allResults.total} executions in ${listTime.toFixed(2)}ms`);

      expect(allResults.total).toBe(numExecutions);
      expect(listTime).toBeLessThan(500); // Should be under 500ms

      // Benchmark filtered queries
      const filterStart = performance.now();
      const runningResults = await store.listExecutions({ state: ExecutionState.RUNNING });
      const filterTime = performance.now() - filterStart;
      console.log(`Filtered ${runningResults.items.length} running executions in ${filterTime.toFixed(2)}ms`);

      expect(filterTime).toBeLessThan(100); // Should be under 100ms

      // Benchmark pagination
      const pageStart = performance.now();
      const pageResults = await store.listExecutions({ limit: 50, offset: 500 });
      const pageTime = performance.now() - pageStart;
      console.log(`Paginated 50 executions (offset 500) in ${pageTime.toFixed(2)}ms`);

      expect(pageResults.items.length).toBe(50);
      expect(pageTime).toBeLessThan(50); // Should be under 50ms

      // Benchmark individual retrieval
      const getStart = performance.now();
      for (let i = 0; i < 100; i++) {
        await store.getExecution(`exec-${i}`);
      }
      const getTime = performance.now() - getStart;
      console.log(`Retrieved 100 individual executions in ${getTime.toFixed(2)}ms`);

      expect(getTime).toBeLessThan(200); // Should be under 200ms
    });

    it('should handle concurrent task runs efficiently', async () => {
      // Create workflow and execution
      await store.saveWorkflow({
        id: 'perf-workflow-2',
        definition: { tasks: [], triggers: [] },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const execution = createInitialExecution('perf-workflow-2', 'exec-concurrent');
      await store.createExecution(execution);

      const numTasks = 500;
      const startTime = performance.now();

      // Create many task runs
      for (let i = 0; i < numTasks; i++) {
        const taskRun = createInitialTaskRun('exec-concurrent', `task-${i}`);
        await store.createTaskRun(taskRun);
      }

      const createTime = performance.now() - startTime;
      console.log(`Created ${numTasks} task runs in ${createTime.toFixed(2)}ms`);

      // Benchmark listing task runs for execution
      const listStart = performance.now();
      const taskRuns = await store.listTaskRuns({ executionId: 'exec-concurrent', limit: 1000 });
      const listTime = performance.now() - listStart;
      console.log(`Listed ${taskRuns.items.length} task runs in ${listTime.toFixed(2)}ms`);

      expect(taskRuns.items.length).toBe(numTasks);
      expect(listTime).toBeLessThan(200); // Should be under 200ms
    });
  });

  describe('Concurrent access', () => {
    it('should handle concurrent execution creation', async () => {
      await createTestWorkflow('wf-concurrent');

      // Create multiple executions concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          (async () => {
            const execution = createInitialExecution('wf-concurrent', `exec-concurrent-${i}`);
            await store.createExecution(execution);
            return execution;
          })()
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // Verify all executions were created
      const allExecutions = await store.listExecutions();
      expect(allExecutions.total).toBe(10);
    });

    it('should handle concurrent task run updates', async () => {
      await createTestWorkflow('wf-concurrent-2');
      const execution = createInitialExecution('wf-concurrent-2', 'exec-concurrent-task');
      await store.createExecution(execution);

      // Create multiple task runs
      const taskPromises = [];
      for (let i = 0; i < 5; i++) {
        taskPromises.push(
          (async () => {
            const taskRun = createInitialTaskRun('exec-concurrent-task', `task-${i}`);
            await store.createTaskRun(taskRun);
            return taskRun;
          })()
        );
      }
      await Promise.all(taskPromises);

      // Update task runs concurrently
      const updatePromises = [];
      for (let i = 0; i < 5; i++) {
        updatePromises.push(
          (async () => {
            const taskRun = await store.getTaskRun('exec-concurrent-task', `task-${i}`);
            if (taskRun) {
              taskRun.state = TaskRunState.RUNNING;
              taskRun.timestamps.startedAt = new Date();
              taskRun.timestamps.updatedAt = new Date();
              await store.updateTaskRun(taskRun);
            }
          })()
        );
      }

      await Promise.all(updatePromises);

      // Verify all task runs were updated
      const taskRuns = await store.listTaskRuns({ executionId: 'exec-concurrent-task' });
      expect(taskRuns.items.length).toBe(5);
      expect(taskRuns.items.every(tr => tr.state === TaskRunState.RUNNING)).toBe(true);
    });

    it('should handle transaction conflicts gracefully', async () => {
      await createTestWorkflow('wf-transaction');

      // Test that transactions work correctly (sequentially, since SQLite locks)
      for (let i = 0; i < 3; i++) {
        await store.transaction(async () => {
          const execution = createInitialExecution('wf-transaction', `exec-tx-${i}`);
          await store.createExecution(execution);

          const taskRun = createInitialTaskRun(`exec-tx-${i}`, 'task1');
          await store.createTaskRun(taskRun);
        });
      }

      // Verify all transactions completed successfully
      const executions = await store.listExecutions({ workflowId: 'wf-transaction' });
      expect(executions.total).toBe(3);
    });
  });
});
