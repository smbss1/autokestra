// Worker pool executor with StateStore integration for task run persistence

import type { StateStore } from '../storage/types';
import type { TaskRun } from '../execution/models';
import { createInitialTaskRun } from '../execution/models';
import { TaskRunState } from '../execution/types';

export interface PersistentExecutorConfig {
  stateStore: StateStore;
}

/**
 * Task executor wrapper that persists task run state to StateStore
 */
export class PersistentTaskExecutor {
  constructor(private config: PersistentExecutorConfig) {}

  /**
   * Create a new task run and persist it
   */
  async createTaskRun(executionId: string, taskId: string): Promise<TaskRun> {
    const taskRun = createInitialTaskRun(executionId, taskId);
    await this.config.stateStore.createTaskRun(taskRun);
    return taskRun;
  }

  /**
   * Transition a task run to RUNNING state
   */
  async startTaskRun(executionId: string, taskId: string): Promise<void> {
    const taskRun = await this.config.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) {
      throw new Error(`TaskRun ${executionId}:${taskId} not found`);
    }

    if (taskRun.state !== TaskRunState.PENDING) {
      throw new Error(`Cannot start task run ${executionId}:${taskId} in state ${taskRun.state}`);
    }

    taskRun.state = TaskRunState.RUNNING;
    taskRun.timestamps.startedAt = new Date();
    taskRun.timestamps.updatedAt = new Date();

    await this.config.stateStore.updateTaskRun(taskRun);
  }

  /**
   * Store masked inputs when a task run starts
   */
  async storeTaskRunInputs(executionId: string, taskId: string, inputs: Record<string, any>): Promise<void> {
    const taskRun = await this.config.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) {
      throw new Error(`TaskRun ${executionId}:${taskId} not found`);
    }

    taskRun.inputs = inputs;
    taskRun.timestamps.updatedAt = new Date();

    await this.config.stateStore.updateTaskRun(taskRun);
  }

  /**
   * Complete a task run with a final state
   */
  async completeTaskRun(
    executionId: string,
    taskId: string,
    finalState: TaskRunState.SUCCESS | TaskRunState.FAILED | TaskRunState.CANCELLED,
    error?: string,
    outputs?: Record<string, any>
  ): Promise<void> {
    const taskRun = await this.config.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) {
      throw new Error(`TaskRun ${executionId}:${taskId} not found`);
    }

    taskRun.state = finalState;
    taskRun.timestamps.endedAt = new Date();
    taskRun.timestamps.updatedAt = new Date();

    const startTime = taskRun.timestamps.startedAt?.getTime() || taskRun.timestamps.createdAt.getTime();
    taskRun.durationMs = taskRun.timestamps.endedAt.getTime() - startTime;

    if (error) {
      taskRun.message = error;
      taskRun.error = {
        message: error,
      };
    }

    if (outputs && finalState === TaskRunState.SUCCESS) {
      taskRun.outputs = outputs;
    }

    await this.config.stateStore.updateTaskRun(taskRun);
  }

  /**
   * Create an attempt record for a task run
   */
  async createAttempt(executionId: string, taskId: string, attemptNumber: number): Promise<void> {
    await this.config.stateStore.createAttempt({
      taskRunId: `${executionId}:${taskId}`,
      attemptNumber,
      timestamps: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get all task runs for an execution
   */
  async getTaskRuns(executionId: string): Promise<TaskRun[]> {
    const result = await this.config.stateStore.listTaskRuns({ executionId });
    return result.items;
  }

  /**
   * Get a specific task run
   */
  async getTaskRun(executionId: string, taskId: string): Promise<TaskRun | null> {
    return this.config.stateStore.getTaskRun(executionId, taskId);
  }
}
