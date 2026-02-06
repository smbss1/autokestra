// Test harness for scheduler integration
import { buildWorkflowGraph, selectRunnableTasks, schedulerTick, InMemoryTaskQueue, InMemoryTaskDispatcher } from './index.js';
import type { WorkflowTask, TaskRunState } from './types.js';

export function runSchedulerHarness(tasks: WorkflowTask[]): void {
  console.log('Building workflow graph...');
  const graph = buildWorkflowGraph(tasks);
  console.log('Graph built with', graph.nodes.size, 'nodes');

  const queue = new InMemoryTaskQueue();
  const dispatcher = new InMemoryTaskDispatcher(queue);
  const limits = { maxInFlightGlobal: 2, maxInFlightPerExecution: 10 };

  let states: TaskRunState[] = [];
  let tick = 0;

  while (true) {
    tick++;
    console.log(`\nTick ${tick}:`);
    const now = new Date();
    const runnable = selectRunnableTasks(graph, states, now);
    console.log('Runnable tasks:', runnable);

    if (runnable.length === 0) {
      console.log('No more runnable tasks. Stopping.');
      break;
    }

    const dispatched = schedulerTick(runnable, dispatcher, limits);
    console.log('Dispatched:', dispatched);

    // Simulate completion of dispatched tasks
    for (const taskId of dispatched) {
      states.push({
        taskId,
        status: 'success',
        attemptCount: 1,
        maxAttempts: 1,
        startedAt: now,
        completedAt: now,
      });
      dispatcher.markCompleted(taskId);
    }

    if (tick > 10) {
      console.log('Max ticks reached. Stopping.');
      break;
    }
  }
}