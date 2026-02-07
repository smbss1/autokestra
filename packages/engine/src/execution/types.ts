// Core state enums for executions and task runs
export enum ExecutionState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TaskRunState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Reason codes for terminal states and WAITING
export type ReasonCode =
  | 'USER_CANCELLED'
  | 'TIMEOUT'
  | 'DEPENDENCY_FAILED'
  | 'EXECUTION_FAILED'
  | 'TASK_FAILED'
  | 'BACKOFF'
  | 'RESOURCE_UNAVAILABLE'
  | 'EXTERNAL_EVENT'
  | 'CRASH_RECOVERY'
  | 'SUCCESS'
  | 'ERROR'
  | 'UNKNOWN';

// Timestamp fields
export interface Timestamps {
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  updatedAt: Date;
}