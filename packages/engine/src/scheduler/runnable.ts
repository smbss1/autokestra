// Runnable task selection logic
import type { WorkflowGraph, TaskId, TaskRunState } from './types.js';

export function selectRunnableTasks(
  graph: WorkflowGraph,
  states: TaskRunState[],
  now: Date
): TaskId[] {
  const stateMap = new Map<TaskId, TaskRunState>();
  for (const state of states) {
    stateMap.set(state.taskId, state);
  }

  const runnable: TaskId[] = [];

  for (const [taskId, node] of graph.nodes) {
    const state = stateMap.get(taskId);

    // Check if all dependencies are successful
    const allDepsSuccessful = node.dependencies.every(depId => {
      const depState = stateMap.get(depId);
      return depState && depState.status === 'success';
    });

    if (!allDepsSuccessful) {
      continue;
    }

    // Task is runnable if not started or retryable after failure
    if (!state || state.status === 'pending') {
      runnable.push(taskId);
    } else if (state.status === 'failed' && isRetryEligible(state, now)) {
      runnable.push(taskId);
    }
  }

  // Sort for deterministic ordering
  runnable.sort();
  return runnable;
}

function isRetryEligible(state: TaskRunState, now: Date): boolean {
  if (state.attemptCount >= state.maxAttempts) {
    return false;
  }
  if (state.nextEligibleAt && state.nextEligibleAt > now) {
    return false;
  }
  return true;
}