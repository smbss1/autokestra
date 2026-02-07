// Scheduler with StateStore integration for execution persistence

import type { StateStore } from '../storage/types';
import type { Execution } from '../execution/models';
import { createInitialExecution } from '../execution/models';
import { ExecutionState } from '../execution/types';

export interface SchedulerConfig {
  stateStore: StateStore;
}

/**
 * Scheduler that persists execution state to StateStore
 */
export class PersistentScheduler {
  constructor(private config: SchedulerConfig) {}

  /**
   * Create a new execution and persist it to the state store
   */
  async createExecution(workflowId: string, executionId: string): Promise<Execution> {
    const execution = createInitialExecution(workflowId, executionId);
    await this.config.stateStore.createExecution(execution);
    return execution;
  }

  /**
   * Transition an execution to RUNNING state
   */
  async startExecution(executionId: string): Promise<void> {
    const execution = await this.config.stateStore.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.state !== ExecutionState.PENDING) {
      throw new Error(`Cannot start execution ${executionId} in state ${execution.state}`);
    }

    execution.state = ExecutionState.RUNNING;
    execution.timestamps.startedAt = new Date();
    execution.timestamps.updatedAt = new Date();

    await this.config.stateStore.updateExecution(execution);
  }

  /**
   * Complete an execution with a final state
   */
  async completeExecution(
    executionId: string,
    finalState: ExecutionState.SUCCESS | ExecutionState.FAILED | ExecutionState.CANCELLED
  ): Promise<void> {
    const execution = await this.config.stateStore.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.state = finalState;
    execution.timestamps.endedAt = new Date();
    execution.timestamps.updatedAt = new Date();

    await this.config.stateStore.updateExecution(execution);
  }

  /**
   * Get all active (RUNNING) executions
   */
  async getActiveExecutions(): Promise<Execution[]> {
    return this.config.stateStore.getActiveExecutions();
  }

  /**
   * Get all pending executions that need to be scheduled
   */
  async getPendingExecutions(): Promise<Execution[]> {
    return this.config.stateStore.getPendingExecutions();
  }
}
