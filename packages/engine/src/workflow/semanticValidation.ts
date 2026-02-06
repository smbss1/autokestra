import type { WorkflowDiagnostic } from './diagnostics.js';
import type { Workflow } from './model.js';

export function validateWorkflowSemantics(workflow: Workflow): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = [];

  if (!workflow.tasks || workflow.tasks.length === 0) {
    diagnostics.push({ severity: 'error', path: 'tasks', message: 'Workflow must contain at least one task' });
    return diagnostics;
  }

  const idToIndex = new Map<string, number[]>();
  workflow.tasks.forEach((task, index) => {
    const list = idToIndex.get(task.id) ?? [];
    list.push(index);
    idToIndex.set(task.id, list);
  });

  for (const [taskId, indices] of idToIndex.entries()) {
    if (indices.length > 1) {
      for (const index of indices) {
        diagnostics.push({
          severity: 'error',
          path: `tasks[${index}].id`,
          message: `Duplicate task id '${taskId}'`,
        });
      }
    }
  }

  const knownIds = new Set<string>(workflow.tasks.map(t => t.id));
  workflow.tasks.forEach((task, taskIndex) => {
    task.needs.forEach((needId, needIndex) => {
      if (!knownIds.has(needId)) {
        diagnostics.push({
          severity: 'error',
          path: `tasks[${taskIndex}].needs[${needIndex}]`,
          message: `Unknown dependency '${needId}' (no task with id '${needId}')`,
        });
      }
    });
  });

  diagnostics.push(...detectCycles(workflow));

  return diagnostics;
}

function detectCycles(workflow: Workflow): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = [];

  const nodes = workflow.tasks.map(t => t.id);
  const edges = new Map<string, string[]>();
  workflow.tasks.forEach(task => {
    edges.set(task.id, task.needs);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (node: string) => {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      const cycle = stack.slice(cycleStart).concat(node);
      diagnostics.push({
        severity: 'error',
        path: 'tasks',
        message: `Dependency cycle detected: ${cycle.join(' -> ')}`,
      });
      return;
    }

    visiting.add(node);
    stack.push(node);

    const deps = edges.get(node) ?? [];
    for (const dep of deps) {
      if (edges.has(dep)) {
        dfs(dep);
      }
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return diagnostics;
}
