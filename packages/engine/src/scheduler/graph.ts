// DAG resolution and graph building
import type { WorkflowTask, TaskId, WorkflowGraph, WorkflowGraphNode } from './types.js';

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphValidationError';
  }
}

export function validateTaskIds(tasks: WorkflowTask[]): void {
  const seen = new Set<TaskId>();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      throw new GraphValidationError(`Duplicate task id: ${task.id}`);
    }
    seen.add(task.id);

    if (task.needs.includes(task.id)) {
      throw new GraphValidationError(`Task ${task.id} has self-dependency`);
    }
  }
}

export function validateDependencies(tasks: WorkflowTask[]): void {
  const taskIds = new Set(tasks.map(t => t.id));
  for (const task of tasks) {
    for (const need of task.needs) {
      if (!taskIds.has(need)) {
        throw new GraphValidationError(`Task ${task.id} has missing dependency: ${need}`);
      }
    }
  }
}

export function detectCycles(tasks: WorkflowTask[]): void {
  const graph = new Map<TaskId, TaskId[]>();
  for (const task of tasks) {
    graph.set(task.id, task.needs);
  }

  const visiting = new Set<TaskId>();
  const visited = new Set<TaskId>();

  const dfs = (node: TaskId, path: TaskId[]) => {
    if (visiting.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      throw new GraphValidationError(`Cycle detected: ${cycle.join(' -> ')}`);
    }
    if (visited.has(node)) return;

    visiting.add(node);
    path.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, path);
    }

    path.pop();
    visiting.delete(node);
    visited.add(node);
  };

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }
}

export function buildWorkflowGraph(tasks: WorkflowTask[]): WorkflowGraph {
  validateTaskIds(tasks);
  validateDependencies(tasks);
  detectCycles(tasks);

  const nodes = new Map<TaskId, WorkflowGraphNode>();
  const roots: TaskId[] = [];

  // Create nodes
  for (const task of tasks) {
    nodes.set(task.id, {
      task,
      dependencies: task.needs,
      dependents: [],
    });
  }

  // Build dependents
  for (const task of tasks) {
    for (const dep of task.needs) {
      const depNode = nodes.get(dep)!;
      depNode.dependents.push(task.id);
    }
  }

  // Find roots
  for (const [id, node] of nodes) {
    if (node.dependencies.length === 0) {
      roots.push(id);
    }
  }

  return { nodes, roots };
}

export function topologicalSort(graph: WorkflowGraph): TaskId[] {
  const result: TaskId[] = [];
  const inDegree = new Map<TaskId, number>();
  const queue: TaskId[] = [];

  // Initialize in-degrees
  for (const [id, node] of graph.nodes) {
    inDegree.set(id, node.dependencies.length);
    if (node.dependencies.length === 0) {
      queue.push(id);
    }
  }

  // Sort queue for deterministic ordering
  queue.sort();

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const node = graph.nodes.get(current)!;
    for (const dependent of node.dependents) {
      const degree = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, degree);
      if (degree === 0) {
        // Insert in sorted order for deterministic tie-breaking
        const insertIndex = queue.findIndex(id => id > dependent);
        if (insertIndex === -1) {
          queue.push(dependent);
        } else {
          queue.splice(insertIndex, 0, dependent);
        }
      }
    }
  }

  if (result.length !== graph.nodes.size) {
    throw new GraphValidationError('Graph contains cycles');
  }

  return result;
}