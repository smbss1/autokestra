// Core types for the worker module

export type WorkItemId = string;

export interface WorkItem {
  id: WorkItemId;
  executionId: string;
  taskId: string;
  attempt: number;
  payload: unknown;
  timeoutMs?: number;
}

export interface WorkResult {
  workItemId: WorkItemId;
  outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  result?: unknown;
  error?: Error;
  durationMs: number;
}

export interface WorkerPoolStatus {
  inFlight: number;
  queued: number;
  concurrency: number;
  queueCapacity: number;
}