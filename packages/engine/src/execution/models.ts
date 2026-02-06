import { ExecutionState, TaskRunState, ReasonCode, Timestamps } from './types';

// Execution model
export interface Execution {
  workflowId: string;
  executionId: string;
  state: ExecutionState;
  timestamps: Timestamps;
  reasonCode?: ReasonCode;
  message?: string;
  metadata?: Record<string, any>;
}

// TaskRun model
export interface TaskRun {
  executionId: string;
  taskId: string;
  state: TaskRunState;
  timestamps: Timestamps;
  reasonCode?: ReasonCode;
  message?: string;
}

// Attempt model
export interface Attempt {
  taskRunId: string;
  attemptNumber: number;
  timestamps: Timestamps;
  status?: 'SUCCESS' | 'FAILED';
  resultRef?: string; // reference to result data
}

// Constructors/helpers
export function createInitialExecution(workflowId: string, executionId: string): Execution {
  const now = new Date();
  return {
    workflowId,
    executionId,
    state: ExecutionState.PENDING,
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function createInitialTaskRun(executionId: string, taskId: string): TaskRun {
  const now = new Date();
  return {
    executionId,
    taskId,
    state: TaskRunState.PENDING,
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
  };
}