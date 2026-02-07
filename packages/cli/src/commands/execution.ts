// CLI commands for execution management with StateStore integration

import { Engine } from '@autokestra/engine';
import { ExecutionState } from '@autokestra/engine/src/execution/types';
import { LogStore, LogQueryFilters, LogQueryOptions } from '@autokestra/engine/src/execution/logging';

/**
 * Parse duration string like "5m", "2h", "1d" into milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error('Invalid duration format. Use format like "5m", "2h", "1d"');
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60 * 1000; // minutes
    case 'h': return value * 60 * 60 * 1000; // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    default: throw new Error('Invalid duration unit');
  }
}

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
  withLogs?: boolean;
  withAudit?: boolean;
  logsLimit?: number;
  json?: boolean;
  pretty?: boolean;
}

export interface ExecutionLogsOptions {
  level?: string[];
  since?: string;
  taskId?: string;
  source?: string;
  grep?: string;
  limit?: number;
  offset?: number;
  follow?: boolean;
  json?: boolean;
  pretty?: boolean;
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
    const logStore = new LogStore({ db: engine.getDatabase() });

    const execution = await stateStore.getExecution(executionId);
    if (!execution) {
      console.error(`Execution ${executionId} not found`);
      process.exit(1);
    }

    const taskRuns = await stateStore.listTaskRuns({ executionId });

    // Get logs if requested
    let logs: any[] = [];
    if (options.withLogs) {
      logs = logStore.getLogsByExecution(executionId, {}, { limit: options.logsLimit || 10 });
    }

    // Get audit trail if requested
    let auditTrail: any[] = [];
    if (options.withAudit) {
      auditTrail = logStore.getAuditTrail(executionId);
    }

    if (options.json) {
      const output = {
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
        ...(options.withLogs && { logs }),
        ...(options.withAudit && { auditTrail }),
      };

      console.log(options.pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output));
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

      if (options.withLogs && logs.length > 0) {
        console.log(`\nRecent Logs (${logs.length}):`);
        for (const log of logs) {
          const timestamp = new Date(log.timestamp).toISOString();
          const taskInfo = log.taskId ? `[${log.taskId}] ` : '';
          const level = log.level.padEnd(5);
          console.log(`  ${timestamp} ${level} ${log.source} ${taskInfo}${log.message}`);
        }
      }

      if (options.withAudit && auditTrail.length > 0) {
        console.log(`\nAudit Trail (${auditTrail.length} events):`);
        for (const event of auditTrail) {
          const timestamp = new Date(event.timestamp).toISOString();
          console.log(`  ${timestamp} ${event.eventType}`);
          if (event.metadata && Object.keys(event.metadata).length > 0) {
            console.log(`    ${JSON.stringify(event.metadata)}`);
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
  options: ExecutionLogsOptions = {}
): Promise<void> {
  const engine = new Engine({
    storage: { path: config.dbPath },
    silent: true,
  });

  try {
    await engine.initialize();
    const stateStore = engine.getStateStore();
    const logStore = new LogStore({ db: engine.getDatabase() });

    // Verify execution exists
    const execution = await stateStore.getExecution(executionId);
    if (!execution) {
      console.error(`Execution ${executionId} not found`);
      process.exit(1);
    }

    // Build query filters
    const filters: LogQueryFilters = {};
    if (options.level && options.level.length > 0) {
      filters.level = options.level;
    }
    if (options.taskId) {
      filters.taskId = options.taskId;
    }
    if (options.source) {
      filters.source = options.source;
    }
    if (options.since) {
      filters.since = parseDuration(options.since);
    }

    // Build query options
    const queryOptions: LogQueryOptions = {
      limit: options.limit || 100,
      offset: options.offset || 0,
    };

    // Get logs
    const logs = logStore.getLogsByExecution(executionId, filters, queryOptions);

    // Filter by grep pattern if specified
    let filteredLogs = logs;
    if (options.grep) {
      const regex = new RegExp(options.grep, 'i');
      filteredLogs = logs.filter(log => regex.test(log.message));
    }

    if (options.json) {
      const output = options.pretty
        ? JSON.stringify(filteredLogs, null, 2)
        : JSON.stringify(filteredLogs);
      console.log(output);
    } else {
      if (filteredLogs.length === 0) {
        console.log(`No logs found for execution ${executionId}`);
        return;
      }

      console.log(`\nLogs for execution: ${executionId}\n`);
      for (const log of filteredLogs) {
        const timestamp = new Date(log.timestamp).toISOString();
        const taskInfo = log.taskId ? `[${log.taskId}] ` : '';
        const level = log.level.padEnd(5);
        console.log(`${timestamp} ${level} ${log.source} ${taskInfo}${log.message}`);
        if (log.metadata && Object.keys(log.metadata).length > 0) {
          console.log(`  ${JSON.stringify(log.metadata)}`);
        }
      }

      if (logs.length === (options.limit || 100)) {
        console.log(`\nShowing first ${options.limit || 100} logs. Use --limit to see more.`);
      }
    }

    // Implement --follow for streaming logs
    if (options.follow) {
      await streamLogs(engine, executionId, options);
      return;
    }
  } finally {
    await engine.shutdown();
  }
}

/**
 * Stream logs for a running execution in real-time
 */
async function streamLogs(engine: Engine, executionId: string, options: ExecutionLogsOptions): Promise<void> {
  const stateStore = engine.getStateStore();
  const logStore = new LogStore({ db: engine.getDatabase() });

  let lastTimestamp = Date.now();
  let executionCompleted = false;

  console.log(`\nStreaming logs for execution: ${executionId}`);
  console.log('Press Ctrl+C to stop\n');

  // Stream logs until execution completes or user interrupts
  while (!executionCompleted) {
    try {
      // Check if execution is still running
      const execution = await stateStore.getExecution(executionId);
      if (!execution) {
        console.error(`Execution ${executionId} not found`);
        return;
      }

      if (execution.state === ExecutionState.SUCCESS ||
          execution.state === ExecutionState.FAILED ||
          execution.state === ExecutionState.CANCELLED) {
        executionCompleted = true;
        console.log(`\nExecution ${execution.state.toLowerCase()}`);
        break;
      }

      // Get new logs since last check
      const newLogs = logStore.getLogsByExecution(executionId, {}, {
        limit: 1000 // Get up to 1000 new logs per poll
      }).filter(log => log.timestamp > lastTimestamp);

      // Display new logs
      for (const log of newLogs) {
        const timestamp = new Date(log.timestamp).toISOString();
        const taskInfo = log.taskId ? `[${log.taskId}] ` : '';
        const level = log.level.padEnd(5);
        console.log(`${timestamp} ${level} ${log.source} ${taskInfo}${log.message}`);
        if (log.metadata && Object.keys(log.metadata).length > 0) {
          console.log(`  ${JSON.stringify(log.metadata)}`);
        }
      }

      // Update last timestamp
      if (newLogs.length > 0) {
        lastTimestamp = Math.max(...newLogs.map(log => log.timestamp));
      }

      // Wait before next poll (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('Error streaming logs:', error);
      break;
    }
  }

  console.log('\nLog streaming completed');
}
