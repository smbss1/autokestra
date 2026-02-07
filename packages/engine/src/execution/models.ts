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
  logEntryCount?: number;
}

// Log metrics for execution metadata
export interface ExecutionLogMetrics {
  totalLogs: number;
  logsByLevel: {
    DEBUG: number;
    INFO: number;
    WARN: number;
    ERROR: number;
  };
  logsBySource: {
    scheduler: number;
    worker: number;
    plugin: number;
  };
  firstLogAt?: Date;
  lastLogAt?: Date;
}

// TaskRun model
export interface TaskRun {
  executionId: string;
  taskId: string;
  state: TaskRunState;
  timestamps: Timestamps;
  reasonCode?: ReasonCode;
  message?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error?: Record<string, any>;
  durationMs?: number;
  metadata?: Record<string, any>;
}

// Log metrics for task run metadata
export interface TaskRunLogMetrics {
  totalLogs: number;
  logsByLevel: {
    DEBUG: number;
    INFO: number;
    WARN: number;
    ERROR: number;
  };
  firstLogAt?: Date;
  lastLogAt?: Date;
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
    logEntryCount: 0,
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
    durationMs: undefined,
    inputs: undefined,
    outputs: undefined,
    error: undefined,
    metadata: undefined,
  };
}