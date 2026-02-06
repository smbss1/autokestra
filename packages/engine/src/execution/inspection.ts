import { Execution, TaskRun } from './models';

// Stable JSON representation for inspection
export interface ExecutionInspection {
  workflowId: string;
  executionId: string;
  state: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  updatedAt: string;
  reasonCode?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface TaskRunInspection {
  executionId: string;
  taskId: string;
  state: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  updatedAt: string;
  reasonCode?: string;
  message?: string;
}

export function inspectExecution(execution: Execution): ExecutionInspection {
  return {
    workflowId: execution.workflowId,
    executionId: execution.executionId,
    state: execution.state,
    createdAt: execution.timestamps.createdAt.toISOString(),
    startedAt: execution.timestamps.startedAt?.toISOString(),
    endedAt: execution.timestamps.endedAt?.toISOString(),
    updatedAt: execution.timestamps.updatedAt.toISOString(),
    reasonCode: execution.reasonCode,
    message: execution.message,
    metadata: execution.metadata,
  };
}

export function inspectTaskRun(taskRun: TaskRun): TaskRunInspection {
  return {
    executionId: taskRun.executionId,
    taskId: taskRun.taskId,
    state: taskRun.state,
    createdAt: taskRun.timestamps.createdAt.toISOString(),
    startedAt: taskRun.timestamps.startedAt?.toISOString(),
    endedAt: taskRun.timestamps.endedAt?.toISOString(),
    updatedAt: taskRun.timestamps.updatedAt.toISOString(),
    reasonCode: taskRun.reasonCode,
    message: taskRun.message,
  };
}