// CLI commands for execution management with StateStore integration

import { Engine } from '@autokestra/engine';
import { ExecutionState } from '@autokestra/engine/src/execution/types';

export interface CliConfig {
  dbPath: string;
}

export interface ExecutionListOptions {
  workflowId?: string;
  state?: string;
  limit?: number;
  offset?: number;
  json?: boolean;
}

export interface ExecutionInspectOptions {
  json?: boolean;
}

export interface ExecutionCleanupOptions {
  days?: number;
  states?: string[];
  dryRun?: boolean;
  json?: boolean;
}

/**
 * Clean up old executions from the state store
 */
export async function cleanupExecutions(
  config: CliConfig,
  options: ExecutionCleanupOptions = {}
): Promise<void> {
  const engine = new Engine({
    storage: { path: config.dbPath },
    silent: true, // Suppress engine logging
  });

  try {
    await engine.initialize();
    const stateStore = engine.getStateStore();

    const retentionDays = options.days || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const states = options.states?.map(s => s as ExecutionState) || [
      ExecutionState.SUCCESS,
      ExecutionState.FAILED,
      ExecutionState.CANCELLED,
    ];

    if (options.dryRun) {
      // Just count what would be deleted
      const result = await stateStore.listExecutions({
        createdBefore: cutoffDate,
        state: states,
      });

      if (options.json) {
        console.log(JSON.stringify({
          dryRun: true,
          cutoffDate: cutoffDate.toISOString(),
          states,
          wouldDelete: result.total,
        }, null, 2));
      } else {
        console.log(`Dry run: Would delete ${result.total} executions older than ${cutoffDate.toISOString()}`);
        console.log(`States: ${states.join(', ')}`);
      }
    } else {
      // Actually delete
      const deletedCount = await stateStore.deleteExecutionsBefore(cutoffDate, states);

      if (options.json) {
        console.log(JSON.stringify({
          deleted: deletedCount,
          cutoffDate: cutoffDate.toISOString(),
          states,
        }, null, 2));
      } else {
        console.log(`Deleted ${deletedCount} executions older than ${cutoffDate.toISOString()}`);
        console.log(`States: ${states.join(', ')}`);
      }
    }
  } finally {
    await engine.shutdown();
  }
}

/**
 * List executions from the state store
 */
export async function listExecutions(
  config: CliConfig,
  options: ExecutionListOptions = {}
): Promise<void> {
  const engine = new Engine({
    storage: { path: config.dbPath },
    silent: true, // Suppress engine logging
  });

  try {
    await engine.initialize();
    const stateStore = engine.getStateStore();

    const result = await stateStore.listExecutions({
      workflowId: options.workflowId,
      state: options.state as ExecutionState | undefined,
      limit: options.limit || 20,
      offset: options.offset || 0,
    });

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            executions: result.items.map((e) => ({
              executionId: e.executionId,
              workflowId: e.workflowId,
              state: e.state,
              createdAt: e.timestamps.createdAt,
              startedAt: e.timestamps.startedAt,
              endedAt: e.timestamps.endedAt,
            })),
            total: result.total,
          },
          null,
          2
        )
      );
    } else {
      if (result.items.length === 0) {
        console.log('No executions found');
        return;
      }

      console.log(`Found ${result.total} execution(s):\n`);
      for (const exec of result.items) {
        const duration = exec.timestamps.endedAt
          ? `${exec.timestamps.endedAt.getTime() - exec.timestamps.createdAt.getTime()}ms`
          : 'ongoing';
        console.log(
          `  ${exec.executionId} [${exec.state}] - workflow: ${exec.workflowId} - duration: ${duration}`
        );
      }
    }
  } finally {
    await engine.shutdown();
  }
}

/**
 * Inspect a specific execution
 */
export async function inspectExecution(
  config: CliConfig,
  executionId: string,
  options: ExecutionInspectOptions = {}
): Promise<void> {
  const engine = new Engine({
    storage: { path: config.dbPath },
    silent: true,
  });

  try {
    await engine.initialize();
    const stateStore = engine.getStateStore();

    const execution = await stateStore.getExecution(executionId);
    if (!execution) {
      console.error(`Execution ${executionId} not found`);
      process.exit(1);
    }

    const taskRuns = await stateStore.listTaskRuns({ executionId });

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            execution: {
              executionId: execution.executionId,
              workflowId: execution.workflowId,
              state: execution.state,
              reasonCode: execution.reasonCode,
              message: execution.message,
              metadata: execution.metadata,
              timestamps: execution.timestamps,
            },
            taskRuns: taskRuns.items.map((tr) => ({
              taskId: tr.taskId,
              state: tr.state,
              reasonCode: tr.reasonCode,
              message: tr.message,
              timestamps: tr.timestamps,
            })),
          },
          null,
          2
        )
      );
    } else {
      console.log(`\nExecution: ${execution.executionId}`);
      console.log(`Workflow: ${execution.workflowId}`);
      console.log(`State: ${execution.state}`);
      if (execution.reasonCode) {
        console.log(`Reason: ${execution.reasonCode}`);
      }
      if (execution.message) {
        console.log(`Message: ${execution.message}`);
      }
      console.log(`Created: ${execution.timestamps.createdAt}`);
      if (execution.timestamps.startedAt) {
        console.log(`Started: ${execution.timestamps.startedAt}`);
      }
      if (execution.timestamps.endedAt) {
        console.log(`Ended: ${execution.timestamps.endedAt}`);
      }

      if (taskRuns.items.length > 0) {
        console.log(`\nTask Runs (${taskRuns.items.length}):`);
        for (const tr of taskRuns.items) {
          console.log(`  ${tr.taskId} [${tr.state}]`);
          if (tr.message) {
            console.log(`    ${tr.message}`);
          }
        }
      }
    }
  } finally {
    await engine.shutdown();
  }
}

/**
 * Get logs for an execution (task run outputs)
 */
export async function getExecutionLogs(
  config: CliConfig,
  executionId: string,
  options: { json?: boolean } = {}
): Promise<void> {
  const engine = new Engine({
    storage: { path: config.dbPath },
    silent: true,
  });

  try {
    await engine.initialize();
    const stateStore = engine.getStateStore();

    const execution = await stateStore.getExecution(executionId);
    if (!execution) {
      console.error(`Execution ${executionId} not found`);
      process.exit(1);
    }

    const taskRuns = await stateStore.listTaskRuns({ executionId });

    if (options.json) {
      const logs = await Promise.all(
        taskRuns.items.map(async (tr) => ({
          taskId: tr.taskId,
          attempts: await stateStore.getAttempts(`${executionId}:${tr.taskId}`),
        }))
      );
      console.log(JSON.stringify({ logs }, null, 2));
    } else {
      console.log(`\nLogs for execution: ${executionId}\n`);
      for (const tr of taskRuns.items) {
        console.log(`Task: ${tr.taskId} [${tr.state}]`);
        const attempts = await stateStore.getAttempts(`${executionId}:${tr.taskId}`);
        for (const attempt of attempts) {
          console.log(`  Attempt ${attempt.attemptNumber}:`);
          console.log(`    Created: ${attempt.timestamps.createdAt}`);
        }
      }
    }
  } finally {
    await engine.shutdown();
  }
}
