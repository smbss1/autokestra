import type { Database } from 'bun:sqlite';

import { createInitialExecution, createInitialTaskRun, type Execution, type TaskRun } from '../execution/models';
import { ExecutionState, TaskRunState } from '../execution/types';
import type { StoredWorkflow, StateStore } from '../storage/types';
import { buildWorkflowGraph, topologicalSort } from '../scheduler/graph';
import { LogCollector } from '../execution/logging';
import { WorkflowTaskExecutor } from '../worker/executor';
import { SecretResolver, SecretStore } from '@autokestra/secrets';

export interface RunWorkflowOptions {
  stateStore: StateStore;
  db: Database;
  storedWorkflow: StoredWorkflow;
  executionId: string;
  scheduledAt?: Date;
  pluginPaths: string[];
  silent?: boolean;
  /** Optional secret resolver (recommended). */
  secretResolver?: SecretResolver;
}

function nowDate(): Date {
  return new Date();
}

async function updateExecution(stateStore: StateStore, execution: Execution): Promise<void> {
  execution.timestamps.updatedAt = nowDate();
  await stateStore.updateExecution(execution);
}

async function updateTaskRun(stateStore: StateStore, taskRun: TaskRun): Promise<void> {
  taskRun.timestamps.updatedAt = nowDate();
  await stateStore.updateTaskRun(taskRun);
}

export async function runStoredWorkflowOnce(options: RunWorkflowOptions): Promise<void> {
  const silent = options.silent ?? false;
  const wf = options.storedWorkflow;

  const definition = wf.definition as any;
  const tasks = (definition?.tasks ?? []) as any[];

  const graph = buildWorkflowGraph(tasks);
  const order = topologicalSort(graph);

  const execution = createInitialExecution(wf.id, options.executionId);
  execution.metadata = {
    triggerType: 'cron',
    scheduledAt: options.scheduledAt?.toISOString(),
  };

  await options.stateStore.createExecution(execution);

  // Transition to RUNNING
  execution.state = ExecutionState.RUNNING;
  execution.timestamps.startedAt = nowDate();
  await updateExecution(options.stateStore, execution);

  const logCollector = new LogCollector({ db: options.db });

  let ownedSecretStore: SecretStore | undefined;
  const secretResolver = options.secretResolver
    ? options.secretResolver
    : (() => {
        ownedSecretStore = new SecretStore();
        return new SecretResolver(ownedSecretStore);
      })();

  const executor = new WorkflowTaskExecutor(
    { paths: options.pluginPaths },
    secretResolver,
    logCollector,
    options.stateStore,
  );

  const declaredSecrets = Array.isArray((definition as any)?.secrets)
    ? (definition as any).secrets.map((s: any) => String(s).trim()).filter(Boolean)
    : [];

  try {
    for (const taskId of order) {
      const node = graph.nodes.get(taskId);
      if (!node) {
        throw new Error(`Task '${taskId}' not found in graph`);
      }

      const task = node.task as any;

      const taskRun = createInitialTaskRun(execution.executionId, task.id);
      await options.stateStore.createTaskRun(taskRun);

      // Start task
      taskRun.state = TaskRunState.RUNNING;
      taskRun.timestamps.startedAt = nowDate();
      await updateTaskRun(options.stateStore, taskRun);

      const workItemId = `${execution.executionId}:${task.id}:1`;
      const result = await executor.execute(
        {
          id: workItemId,
          executionId: execution.executionId,
          taskId: task.id,
          attempt: 1,
          payload: {
            executionId: execution.executionId,
            taskId: task.id,
            type: task.type,
            inputs: task.inputs ?? {},
            allowedSecrets: declaredSecrets,
          },
        },
        new AbortController().signal,
      );

      if (result.outcome === 'SUCCESS') {
        taskRun.state = TaskRunState.SUCCESS;
        taskRun.timestamps.endedAt = nowDate();
        taskRun.durationMs = result.durationMs;
        taskRun.outputs = (result.result ?? {}) as any;
        await updateTaskRun(options.stateStore, taskRun);
        continue;
      }

      taskRun.state = TaskRunState.FAILED;
      taskRun.timestamps.endedAt = nowDate();
      taskRun.durationMs = result.durationMs;
      taskRun.message = result.error?.message ?? 'Task failed';
      taskRun.error = {
        message: result.error?.message ?? 'Task failed',
        stack: result.error?.stack,
      };
      await updateTaskRun(options.stateStore, taskRun);

      execution.state = ExecutionState.FAILED;
      execution.reasonCode = 'TASK_FAILED';
      execution.message = `Task '${task.id}' failed`;
      execution.timestamps.endedAt = nowDate();
      await updateExecution(options.stateStore, execution);
      return;
    }

    execution.state = ExecutionState.SUCCESS;
    execution.reasonCode = 'SUCCESS';
    execution.timestamps.endedAt = nowDate();
    await updateExecution(options.stateStore, execution);
  } catch (err) {
    execution.state = ExecutionState.FAILED;
    execution.reasonCode = 'ERROR';
    execution.message = err instanceof Error ? err.message : String(err);
    execution.timestamps.endedAt = nowDate();
    await updateExecution(options.stateStore, execution);

    if (!silent) {
      // eslint-disable-next-line no-console
      console.error('workflow run failed:', err);
    }
  } finally {
    logCollector.close();
    try {
      ownedSecretStore?.close();
    } catch {
      // ignore
    }
  }
}
