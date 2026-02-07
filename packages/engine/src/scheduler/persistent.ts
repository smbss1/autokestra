// Scheduler with StateStore integration for execution persistence

import type { StateStore } from '../storage/types';
import type { Execution } from '../execution/models';
import { createInitialExecution } from '../execution/models';
import { ExecutionState } from '../execution/types';
import { LogCollector, AuditLogger } from '../execution/logging';

export interface SchedulerConfig {
  stateStore: StateStore;
  logCollector?: LogCollector;
  auditLogger?: AuditLogger;
}

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
    
    // Log execution created
    this.config.logCollector?.log({
      executionId,
      timestamp: Date.now(),
      level: 'INFO',
      source: 'scheduler',
      message: `Execution created for workflow ${workflowId}`,
      metadata: { workflowId, triggerType: 'manual' }, // TODO: pass actual trigger type
    });

    // Audit execution created
    this.config.auditLogger?.emitCreated(executionId, workflowId, 'manual');
    
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

    const fromState = execution.state;
    execution.state = ExecutionState.RUNNING;
    execution.timestamps.startedAt = new Date();
    execution.timestamps.updatedAt = new Date();

    await this.config.stateStore.updateExecution(execution);
    
    // Log execution started
    this.config.logCollector?.log({
      executionId,
      timestamp: Date.now(),
      level: 'INFO',
      source: 'scheduler',
      message: `Execution started (transition to RUNNING)`,
    });

    // Audit state change and started event
    this.config.auditLogger?.emitStateChange(executionId, fromState, ExecutionState.RUNNING);
    this.config.auditLogger?.emitStarted(executionId);
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

    const fromState = execution.state;
    execution.state = finalState;
    execution.timestamps.endedAt = new Date();
    execution.timestamps.updatedAt = new Date();

    await this.config.stateStore.updateExecution(execution);
    
    // Log execution completed
    const duration = execution.timestamps.endedAt.getTime() - (execution.timestamps.startedAt?.getTime() || execution.timestamps.createdAt.getTime());
    this.config.logCollector?.log({
      executionId,
      timestamp: Date.now(),
      level: 'INFO',
      source: 'scheduler',
      message: `Execution ${finalState.toLowerCase()} with duration ${duration}ms`,
      metadata: { 
        finalState, 
        duration,
        reasonCode: execution.reasonCode,
        message: execution.message 
      },
    });

    // Audit state change and completion
    this.config.auditLogger?.emitStateChange(executionId, fromState, finalState);
    if (finalState === ExecutionState.SUCCESS) {
      this.config.auditLogger?.emitCompleted(executionId, duration);
    } else if (finalState === ExecutionState.FAILED) {
      this.config.auditLogger?.emitFailed(executionId, execution.reasonCode || 'UNKNOWN', execution.message);
    } else if (finalState === ExecutionState.CANCELLED) {
      this.config.auditLogger?.emitCancelled(executionId, execution.reasonCode || 'USER_REQUEST');
    }
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
