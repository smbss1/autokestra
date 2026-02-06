// Unit tests for bounded queue

import { describe, it, expect } from 'bun:test';
import { BoundedQueue } from './queue';

describe('BoundedQueue', () => {
  it('should enforce capacity', () => {
    const queue = new BoundedQueue(2);
    expect(queue.tryEnqueue({ id: '1', executionId: 'e1', taskId: 't1', attempt: 1, payload: {} })).toBe(true);
    expect(queue.tryEnqueue({ id: '2', executionId: 'e1', taskId: 't2', attempt: 1, payload: {} })).toBe(true);
    expect(queue.tryEnqueue({ id: '3', executionId: 'e1', taskId: 't3', attempt: 1, payload: {} })).toBe(false);
    expect(queue.size()).toBe(2);
    expect(queue.isFull()).toBe(true);
  });

  it('should dequeue in FIFO order', () => {
    const queue = new BoundedQueue(3);
    const item1 = { id: '1', executionId: 'e1', taskId: 't1', attempt: 1, payload: {} };
    const item2 = { id: '2', executionId: 'e1', taskId: 't2', attempt: 1, payload: {} };
    const item3 = { id: '3', executionId: 'e1', taskId: 't3', attempt: 1, payload: {} };
    queue.tryEnqueue(item1);
    queue.tryEnqueue(item2);
    queue.tryEnqueue(item3);
    expect(queue.dequeue()).toBe(item1);
    expect(queue.dequeue()).toBe(item2);
    expect(queue.dequeue()).toBe(item3);
    expect(queue.dequeue()).toBeUndefined();
  });
});