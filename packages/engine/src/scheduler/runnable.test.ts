import { describe, it, expect } from 'bun:test';
import { selectRunnableTasks } from './runnable.js';
import { buildWorkflowGraph } from './graph.js';
import type { WorkflowTask, TaskRunState } from './types.js';

describe('Runnable Selection', () => {
  it('should return root tasks as runnable', () => {
    const tasks: WorkflowTask[] = [
      { id: 'task1', type: 'test', needs: [] },
      { id: 'task2', type: 'test', needs: ['task1'] },
    ];
    const graph = buildWorkflowGraph(tasks);
    const states: TaskRunState[] = [];
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    expect(runnable).toEqual(['task1']);
  });

  it('should return dependent task after dependency succeeds', () => {
    const tasks: WorkflowTask[] = [
      { id: 'task1', type: 'test', needs: [] },
      { id: 'task2', type: 'test', needs: ['task1'] },
    ];
    const graph = buildWorkflowGraph(tasks);
    const states: TaskRunState[] = [
      { taskId: 'task1', status: 'success', attemptCount: 1, maxAttempts: 1 },
    ];
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    expect(runnable).toEqual(['task2']);
  });

  it('should not return tasks blocked by failed dependency', () => {
    const tasks: WorkflowTask[] = [
      { id: 'task1', type: 'test', needs: [] },
      { id: 'task2', type: 'test', needs: ['task1'] },
    ];
    const graph = buildWorkflowGraph(tasks);
    const states: TaskRunState[] = [
      { taskId: 'task1', status: 'failed', attemptCount: 1, maxAttempts: 1 },
    ];
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    expect(runnable).toEqual([]);
  });

  it('should return retryable failed tasks after backoff', () => {
    const tasks: WorkflowTask[] = [
      { id: 'task1', type: 'test', needs: [], retry: { max: 2 } },
    ];
    const graph = buildWorkflowGraph(tasks);
    const past = new Date(Date.now() - 1000);
    const states: TaskRunState[] = [
      { taskId: 'task1', status: 'failed', attemptCount: 1, maxAttempts: 2, nextEligibleAt: past },
    ];
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    expect(runnable).toEqual(['task1']);
  });

  it('should not return retryable tasks before backoff', () => {
    const tasks: WorkflowTask[] = [
      { id: 'task1', type: 'test', needs: [], retry: { max: 2 } },
    ];
    const graph = buildWorkflowGraph(tasks);
    const future = new Date(Date.now() + 1000);
    const states: TaskRunState[] = [
      { taskId: 'task1', status: 'failed', attemptCount: 1, maxAttempts: 2, nextEligibleAt: future },
    ];
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    expect(runnable).toEqual([]);
  });

  it('should return runnable tasks in sorted order', () => {
    const tasks: WorkflowTask[] = [
      { id: 'b', type: 'test', needs: [] },
      { id: 'a', type: 'test', needs: [] },
    ];
    const graph = buildWorkflowGraph(tasks);
    const states: TaskRunState[] = [];
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    expect(runnable).toEqual(['a', 'b']);
  });
});