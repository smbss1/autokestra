// Scheduler with StateStore integration for execution persistence

import type { StateStore } from '../storage/types';
import type { Execution } from '../execution/models';
import { createInitialExecution } from '../execution/models';
import { ExecutionState, TaskRunState } from '../execution/types';
import { LogCollector, AuditLogger, LogMetricsTracker } from '../execution/logging';

export interface SchedulerConfig {
  stateStore: StateStore;
  logCollector?: LogCollector;
  auditLogger?: AuditLogger;
  logMetricsTracker?: LogMetricsTracker;
}

/**
 * Scheduler that persists execution state to StateStore
 */
export class PersistentScheduler {
  constructor(private config: SchedulerConfig) {}

  /**
   * Create a new execution and persist it to the state store
   */
  async createExecution(workflowId: string, executionId: string, triggerType: string = 'manual'): Promise<Execution> {
    const execution = createInitialExecution(workflowId, executionId);
    await this.config.stateStore.createExecution(execution);
    
    // Log execution created
    this.config.logCollector?.log({
      executionId,
      timestamp: Date.now(),
      level: 'INFO',
      source: 'scheduler',
      message: `Execution created for workflow ${workflowId}`,
      metadata: { workflowId, triggerType },
    });

    // Audit execution created
    this.config.auditLogger?.emitCreated(executionId, workflowId, triggerType);
    
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

    // Update log metrics in metadata before saving
    if (this.config.logMetricsTracker) {
      const logMetrics = this.config.logMetricsTracker.getExecutionLogMetrics(executionId);
      if (logMetrics) {
        execution.metadata = {
          ...execution.metadata,
          logMetrics,
        };
      }
    }

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
   * Get all pending executions
   */
  async getPendingExecutions(): Promise<Execution[]> {
    return this.config.stateStore.getPendingExecutions();
  }

  /**
   * Cancel an execution with a reason
   */
  async cancelExecution(executionId: string, reason: string = 'USER_REQUEST'): Promise<void> {
    const execution = await this.config.stateStore.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.state === ExecutionState.SUCCESS || execution.state === ExecutionState.FAILED || execution.state === ExecutionState.CANCELLED) {
      // Idempotent - already in terminal state
      return;
    }

    const fromState = execution.state;
    execution.state = ExecutionState.CANCELLED;
    execution.reasonCode = reason;
    execution.timestamps.endedAt = new Date();
    execution.timestamps.updatedAt = new Date();

    // Update log metrics in metadata before saving
    if (this.config.logMetricsTracker) {
      const logMetrics = this.config.logMetricsTracker.getExecutionLogMetrics(executionId);
      if (logMetrics) {
        execution.metadata = {
          ...execution.metadata,
          logMetrics,
        };
      }
    }

    await this.config.stateStore.updateExecution(execution);

    // Propagate cancellation to running task runs
    const runningTasks = await this.config.stateStore.listTaskRuns({
      executionId,
      state: [TaskRunState.RUNNING, TaskRunState.PENDING]
    });

    for (const taskRun of runningTasks.items) {
      await this.cancelTaskRun(executionId, taskRun.taskId, reason);
    }

    // Log cancellation
    this.config.logCollector?.log({
      executionId,
      timestamp: Date.now(),
      level: 'WARN',
      source: 'scheduler',
      message: `Execution cancelled with reason: ${reason}`,
      metadata: { reason, fromState, cancelledTasks: runningTasks.items.length },
    });

    // Audit cancellation
    this.config.auditLogger?.emitStateChange(executionId, fromState, ExecutionState.CANCELLED, reason);
    this.config.auditLogger?.emitCancelled(executionId, reason);
  }

  /**
   * Mark an execution as timed out
   */
  async timeoutExecution(executionId: string, duration: number): Promise<void> {
    const execution = await this.config.stateStore.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.state === ExecutionState.SUCCESS || execution.state === ExecutionState.FAILED || execution.state === ExecutionState.CANCELLED) {
      // Idempotent - already in terminal state
      return;
    }

    const fromState = execution.state;
    execution.state = ExecutionState.FAILED;
    execution.reasonCode = 'TIMEOUT';
    execution.message = `Execution timed out after ${duration}ms`;
    execution.timestamps.endedAt = new Date();
    execution.timestamps.updatedAt = new Date();

    // Update log metrics in metadata before saving
    if (this.config.logMetricsTracker) {
      const logMetrics = this.config.logMetricsTracker.getExecutionLogMetrics(executionId);
      if (logMetrics) {
        execution.metadata = {
          ...execution.metadata,
          logMetrics,
        };
      }
    }

    await this.config.stateStore.updateExecution(execution);

    // Log timeout
    this.config.logCollector?.log({
      executionId,
      timestamp: Date.now(),
      level: 'ERROR',
      source: 'scheduler',
      message: `Execution timed out after ${duration}ms`,
      metadata: { duration, fromState },
    });

    // Audit timeout
    this.config.auditLogger?.emitStateChange(executionId, fromState, ExecutionState.FAILED, 'TIMEOUT');
    this.config.auditLogger?.emitTimeout(executionId, duration);
  }

  /**
   * Cancel a task run with a reason
   */
  async cancelTaskRun(executionId: string, taskId: string, reason: string = 'EXECUTION_CANCELLED'): Promise<void> {
    const taskRun = await this.config.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) {
      throw new Error(`Task run ${executionId}:${taskId} not found`);
    }

    if (taskRun.state === TaskRunState.SUCCESS || taskRun.state === TaskRunState.FAILED || taskRun.state === TaskRunState.CANCELLED) {
      // Idempotent - already in terminal state
      return;
    }

    const fromState = taskRun.state;
    taskRun.state = TaskRunState.CANCELLED;
    taskRun.reasonCode = reason;
    taskRun.timestamps.endedAt = new Date();
    taskRun.timestamps.updatedAt = new Date();

    // Update log metrics in metadata before saving
    if (this.config.logMetricsTracker) {
      const logMetrics = this.config.logMetricsTracker.getTaskRunLogMetrics(executionId, taskId);
      if (logMetrics) {
        taskRun.metadata = {
          ...taskRun.metadata,
          logMetrics,
        };
      }
    }

    await this.config.stateStore.updateTaskRun(taskRun);

    // Log task run cancellation
    this.config.logCollector?.log({
      executionId,
      taskId,
      timestamp: Date.now(),
      level: 'WARN',
      source: 'scheduler',
      message: `Task run cancelled with reason: ${reason}`,
      metadata: {
        reason,
        fromState,
        duration: taskRun.timestamps.endedAt.getTime() - (taskRun.timestamps.startedAt?.getTime() || taskRun.timestamps.createdAt.getTime()),
      },
    });
  }

  /**
   * Complete a task run with a final state
   */
  async completeTaskRun(
    executionId: string,
    taskId: string,
    finalState: TaskRunState.SUCCESS | TaskRunState.FAILED | TaskRunState.CANCELLED
  ): Promise<void> {
    const taskRun = await this.config.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) {
      throw new Error(`Task run ${executionId}:${taskId} not found`);
    }

    const fromState = taskRun.state;
    taskRun.state = finalState;
    taskRun.timestamps.endedAt = new Date();
    taskRun.timestamps.updatedAt = new Date();

    // Update log metrics in metadata before saving
    if (this.config.logMetricsTracker) {
      const logMetrics = this.config.logMetricsTracker.getTaskRunLogMetrics(executionId, taskId);
      if (logMetrics) {
        taskRun.metadata = {
          ...taskRun.metadata,
          logMetrics,
        };
      }
    }

    await this.config.stateStore.updateTaskRun(taskRun);

    // Log task run completion
    this.config.logCollector?.log({
      executionId,
      taskId,
      timestamp: Date.now(),
      level: 'INFO',
      source: 'scheduler',
      message: `Task run ${finalState.toLowerCase()}`,
      metadata: {
        finalState,
        duration: taskRun.timestamps.endedAt.getTime() - (taskRun.timestamps.startedAt?.getTime() || taskRun.timestamps.createdAt.getTime()),
      },
    });
  }
}
