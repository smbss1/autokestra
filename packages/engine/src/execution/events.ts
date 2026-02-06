import { ReasonCode } from './types';

// Transition event types for executions
export type ExecutionTransitionEvent =
  | { type: 'EXECUTION_STARTED' }
  | { type: 'EXECUTION_SUCCEEDED' }
  | { type: 'EXECUTION_FAILED'; reasonCode: ReasonCode; message?: string }
  | { type: 'EXECUTION_CANCELLED'; reasonCode: ReasonCode; message?: string }
  | { type: 'EXECUTION_TIMED_OUT' }
  | { type: 'CANCELLATION_REQUESTED' };

// Transition event types for task runs
export type TaskRunTransitionEvent =
  | { type: 'TASK_STARTED' }
  | { type: 'TASK_SUCCEEDED' }
  | { type: 'TASK_FAILED'; reasonCode: ReasonCode; message?: string }
  | { type: 'TASK_CANCELLED'; reasonCode: ReasonCode; message?: string }
  | { type: 'TASK_TIMED_OUT' }
  | { type: 'TASK_WAITING'; reasonCode: ReasonCode; message?: string };