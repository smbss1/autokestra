// Scheduler dispatch loop and interfaces
// 
// Integration points for execution state store:
// - TaskRunState persistence: store and retrieve task states atomically
// - Execution-level concurrency: track in-flight tasks per execution ID
// - Scheduler tick coordination: ensure ticks are serialized or use optimistic locking
// - Event-driven scheduling: trigger ticks on task state transitions
//
// Placeholders: In future changes, these will integrate with the execution-model-states change.
import type { TaskId } from './types.js';

export interface TaskQueue {
  enqueue(taskId: TaskId): void;
  dequeue(): TaskId | undefined;
  size(): number;
}

export interface TaskDispatcher {
  dispatch(taskIds: TaskId[], limits: SchedulerLimits): TaskId[];
}

export interface SchedulerLimits {
  maxInFlightGlobal: number;
  maxInFlightPerExecution: number;
}

export class InMemoryTaskQueue implements TaskQueue {
  private queue: TaskId[] = [];

  enqueue(taskId: TaskId): void {
    if (!this.queue.includes(taskId)) {
      this.queue.push(taskId);
    }
  }

  dequeue(): TaskId | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }
}

export class InMemoryTaskDispatcher implements TaskDispatcher {
  private queue: TaskQueue;
  private inFlightGlobal = 0;
  private inFlightPerExecution = new Map<string, number>();

  constructor(queue: TaskQueue) {
    this.queue = queue;
  }

  dispatch(taskIds: TaskId[], limits: SchedulerLimits): TaskId[] {
    const availableGlobal = limits.maxInFlightGlobal - this.inFlightGlobal;
    if (availableGlobal <= 0) {
      return [];
    }

    const dispatched: TaskId[] = [];
    for (const taskId of taskIds) {
      // For simplicity, assume executionId is part of taskId or something; in real impl, pass executionId
      const executionId = 'default'; // placeholder
      const inFlightForExec = this.inFlightPerExecution.get(executionId) || 0;
      if (inFlightForExec >= limits.maxInFlightPerExecution) {
        continue;
      }

      this.queue.enqueue(taskId);
      dispatched.push(taskId);
      this.inFlightGlobal++;
      this.inFlightPerExecution.set(executionId, inFlightForExec + 1);

      if (dispatched.length >= availableGlobal) {
        break;
      }
    }

    return dispatched;
  }

  // Methods to update in-flight counts when tasks complete
  markCompleted(taskId: TaskId, executionId: string = 'default'): void {
    this.inFlightGlobal = Math.max(0, this.inFlightGlobal - 1);
    const current = this.inFlightPerExecution.get(executionId) || 0;
    this.inFlightPerExecution.set(executionId, Math.max(0, current - 1));
  }
}

export function schedulerTick(
  runnableTasks: TaskId[],
  dispatcher: TaskDispatcher,
  limits: SchedulerLimits
): TaskId[] {
  // Sort for deterministic selection
  const sortedRunnable = [...runnableTasks].sort();
  return dispatcher.dispatch(sortedRunnable, limits);
}