import { describe, it, expect } from 'bun:test';
import { InMemoryTaskQueue, InMemoryTaskDispatcher, schedulerTick } from './dispatcher.js';

describe('Scheduler Dispatch', () => {
  it('should dispatch tasks up to global limit', () => {
    const queue = new InMemoryTaskQueue();
    const dispatcher = new InMemoryTaskDispatcher(queue);
    const limits = { maxInFlightGlobal: 2, maxInFlightPerExecution: 10 };
    const runnable = ['task1', 'task2', 'task3'];
    const dispatched = schedulerTick(runnable, dispatcher, limits);
    expect(dispatched).toEqual(['task1', 'task2']);
    expect(queue.size()).toBe(2);
  });

  it('should respect per-execution limit', () => {
    const queue = new InMemoryTaskQueue();
    const dispatcher = new InMemoryTaskDispatcher(queue);
    const limits = { maxInFlightGlobal: 10, maxInFlightPerExecution: 1 };
    const runnable = ['task1', 'task2'];
    const dispatched = schedulerTick(runnable, dispatcher, limits);
    expect(dispatched).toEqual(['task1']);
  });

  it('should select tasks deterministically', () => {
    const queue = new InMemoryTaskQueue();
    const dispatcher = new InMemoryTaskDispatcher(queue);
    const limits = { maxInFlightGlobal: 2, maxInFlightPerExecution: 10 };
    const runnable = ['c', 'a', 'b'];
    const dispatched = schedulerTick(runnable, dispatcher, limits);
    expect(dispatched).toEqual(['a', 'b']);
  });

  it('should be idempotent - no duplicate dispatch', () => {
    const queue = new InMemoryTaskQueue();
    const dispatcher = new InMemoryTaskDispatcher(queue);
    const limits = { maxInFlightGlobal: 2, maxInFlightPerExecution: 10 };
    const runnable = ['task1', 'task2'];
    schedulerTick(runnable, dispatcher, limits);
    expect(queue.size()).toBe(2);
    // Second tick with same runnable should not add more
    schedulerTick(runnable, dispatcher, limits);
    expect(queue.size()).toBe(2);
  });
});