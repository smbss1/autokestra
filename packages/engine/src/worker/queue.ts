// Bounded in-memory FIFO queue implementation

import { TaskQueue } from './interfaces';
import { WorkItem } from './types';

export class BoundedQueue implements TaskQueue {
  private items: WorkItem[] = [];
  public readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error('Capacity must be positive');
    this.capacity = capacity;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  tryEnqueue(item: WorkItem): boolean {
    if (this.isFull()) return false;
    this.items.push(item);
    return true;
  }

  async enqueue(item: WorkItem): Promise<void> {
    while (this.isFull()) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Simple polling, could be improved
    }
    this.items.push(item);
  }

  dequeue(): WorkItem | undefined {
    return this.items.shift();
  }
}