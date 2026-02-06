// Interfaces for task queue, worker pool, and task executor

import { WorkItem, WorkResult, WorkerPoolStatus, WorkItemId } from './types';

// Re-export types for convenience
export { WorkItem, WorkResult, WorkerPoolStatus, WorkItemId };

export interface TaskQueue {
  capacity: number;
  size(): number;
  isEmpty(): boolean;
  isFull(): boolean;
  tryEnqueue(item: WorkItem): boolean;
  enqueue(item: WorkItem): Promise<void>;
  dequeue(): WorkItem | undefined;
}

export interface WorkerPool {
  status(): WorkerPoolStatus;
  submit(workItem: WorkItem): Promise<WorkResult>;
  cancel(workItemId: WorkItemId): boolean;
  gracefulShutdown(deadlineMs: number): Promise<void>;
  forceShutdown(): void;
}

export interface TaskExecutor {
  execute(workItem: WorkItem, signal: AbortSignal): Promise<WorkResult>;
}