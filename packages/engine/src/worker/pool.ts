// Worker pool with configurable concurrency

/**
 * Integration with Scheduler Dispatch:
 * - Scheduler checks pool.status().inFlight < concurrency to determine available slots
 * - If slots available, scheduler calls pool.submit(workItem)
 * - If no slots, scheduler can wait or skip based on strategy (e.g., tryEnqueue-like behavior)
 * - Pool emits completion events that scheduler listens to for state transitions
 */

import { WorkerPool, TaskExecutor } from './interfaces';
import { WorkItem, WorkResult, WorkerPoolStatus, WorkItemId } from './types';
import { BoundedQueue } from './queue';

export class LocalWorkerPool implements WorkerPool {
  private queue: BoundedQueue;
  private executor: TaskExecutor;
  private concurrency: number;
  private inFlight = new Map<WorkItemId, AbortController>();
  private running = true;
  private workers: Promise<void>[] = [];

  constructor(queueCapacity: number, concurrency: number, executor: TaskExecutor) {
    this.queue = new BoundedQueue(queueCapacity);
    this.concurrency = concurrency;
    this.executor = executor;
    this.startWorkers();
  }

  private startWorkers() {
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(this.runWorker());
    }
  }

  private async runWorker(): Promise<void> {
    while (this.running) {
      const item = this.queue.dequeue();
      if (!item) {
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }

      const controller = new AbortController();
      this.inFlight.set(item.id, controller);

      try {
        const timeoutController = new AbortController();
        const combinedSignal = this.combineSignals(controller.signal, timeoutController.signal);

        if (item.timeoutMs) {
          setTimeout(() => timeoutController.abort(), item.timeoutMs);
        }

        const result = await this.executor.execute(item, combinedSignal);
        // Emit completion - in real impl, this would be an event or callback
        console.log(`Completed ${item.id}: ${result.outcome}`);
      } catch (error) {
        console.error(`Error executing ${item.id}:`, error);
      } finally {
        this.inFlight.delete(item.id);
      }
    }
  }

  status(): WorkerPoolStatus {
    return {
      inFlight: this.inFlight.size,
      queued: this.queue.size(),
      concurrency: this.concurrency,
      queueCapacity: this.queue.capacity,
    };
  }

  async submit(workItem: WorkItem): Promise<WorkResult> {
    // De-dup guard: prevent concurrent execution of the same work item
    if (this.inFlight.has(workItem.id)) {
      throw new Error(`Work item ${workItem.id} already in progress`);
    }
    await this.queue.enqueue(workItem);
    return new Promise((resolve) => {
      // Placeholder - real impl would track via events
      setTimeout(() => resolve({
        workItemId: workItem.id,
        outcome: 'SUCCESS',
        durationMs: 100,
      }), 100);
    });
  }

  cancel(workItemId: WorkItemId): boolean {
    const controller = this.inFlight.get(workItemId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  async gracefulShutdown(deadlineMs: number): Promise<void> {
    this.running = false;
    const start = Date.now();
    while (this.inFlight.size > 0 && Date.now() - start < deadlineMs) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (this.inFlight.size > 0) {
      this.forceShutdown();
    }
  }

  forceShutdown(): void {
    this.running = false;
    for (const controller of this.inFlight.values()) {
      controller.abort();
    }
    this.inFlight.clear();
  }

  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', onAbort);
    }
    return controller.signal;
  }
}