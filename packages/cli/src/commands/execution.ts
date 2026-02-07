// CLI commands for execution management with StateStore integration

import { Engine } from '@autokestra/engine';
import { ExecutionState, TaskRunState } from '@autokestra/engine/src/execution/types';
import { LogStore, LogQueryFilters } from '@autokestra/engine/src/execution/logging';
import { ExecutionInspector } from '@autokestra/engine/src/execution/inspector';
import type { StateStore } from '@autokestra/engine/src/storage/types';

/**
 * Parse duration string like "5m", "2h", "1d" into milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error('Invalid time format. Examples: 5m, 2h, 1d');
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000; // seconds
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
  showInputs?: boolean;
  timeline?: boolean;
  audit?: boolean;
  json?: boolean;
  noTruncate?: boolean;
  pretty?: boolean;
}

export interface ExecutionLogsOptions {
  level?: string[];
  since?: string;
  taskId?: string;
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

const LEVELS = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']);

function isTty(): boolean {
  return Boolean(process.stdout.isTTY);
}

function colorize(text: string, colorCode: string): string {
  if (!isTty()) return text;
  return `\u001b[${colorCode}m${text}\u001b[0m`;
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function truncateValue(value: string, maxLength: number, noTruncate?: boolean): string {
  if (noTruncate || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}... (truncated)`;
}

function formatStatus(status: TaskRunState | ExecutionState): string {
  switch (status) {
    case ExecutionState.SUCCESS:
    case TaskRunState.SUCCESS:
      return colorize(status, '32'); // green
    case ExecutionState.FAILED:
    case TaskRunState.FAILED:
      return colorize(status, '31'); // red
    case ExecutionState.RUNNING:
    case TaskRunState.RUNNING:
      return colorize(status, '33'); // yellow
    case ExecutionState.PENDING:
    case TaskRunState.PENDING:
      return colorize(status, '90'); // gray
    default:
      return status;
  }
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
    const inspector = new ExecutionInspector(stateStore, logStore);

    const overview = await inspector.getExecutionOverview(executionId);
    if (!overview) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const tasks = await inspector.getTaskDetails(executionId);
    const inputsOutputs = await inspector.getTaskInputsOutputs(executionId);
    const auditTrail = options.audit ? inspector.getAuditTrail(executionId) : undefined;
    const timeline = options.timeline ? await inspector.getTimeline(executionId) : undefined;

    if (options.json) {
      const output = {
        execution: overview,
        tasks,
        inputsOutputs,
        ...(auditTrail ? { auditTrail } : {}),
        ...(timeline ? { timeline } : {}),
      };

      console.log(options.pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output));
      return;
    }

    console.log(`\nExecution: ${overview.executionId}`);
    console.log(`Workflow: ${overview.workflowId}`);
    console.log(`State: ${formatStatus(overview.status)}`);
    if (overview.reasonCode) {
      console.log(`Reason: ${overview.reasonCode}`);
    }
    if (overview.message) {
      console.log(`Message: ${overview.message}`);
    }
    console.log(`Created: ${overview.createdAt}`);
    if (overview.startedAt) {
      console.log(`Started: ${overview.startedAt}`);
    }
    if (overview.endedAt) {
      console.log(`Ended: ${overview.endedAt}`);
    }
    console.log(`Duration: ${formatDuration(overview.durationMs)}`);

    if (tasks.length > 0) {
      console.log(`\nTasks (${tasks.length}):`);
      const headers = ['Task ID', 'Type', 'Status', 'Duration', 'Start', 'End'];
      const rows = tasks.map((task) => [
        task.taskId,
        task.type || '-',
        task.status === TaskRunState.RUNNING ? `⏳ ${formatStatus(task.status)}` : formatStatus(task.status),
        formatDuration(task.durationMs),
        task.startedAt || '-',
        task.endedAt || '-',
      ]);

      const columnWidths = headers.map((header, index) =>
        Math.max(header.length, ...rows.map((row) => row[index].length))
      );

      const formatRow = (row: string[]) =>
        row.map((cell, i) => cell.padEnd(columnWidths[i])).join('  ');

      console.log(formatRow(headers));
      console.log(formatRow(headers.map((h, i) => '-'.repeat(columnWidths[i]))));
      for (const row of rows) {
        console.log(formatRow(row));
      }
    }

    const ioByTask = new Map(inputsOutputs.map((io) => [io.taskId, io]));
    if (options.showInputs || tasks.some((task) => task.status !== TaskRunState.PENDING)) {
      console.log(`\nTask Details:`);
      for (const task of tasks) {
        const io = ioByTask.get(task.taskId);
        if (!io) continue;

        const outputs = io.outputs ? JSON.stringify(io.outputs) : '';
        const inputs = io.inputs ? JSON.stringify(io.inputs) : '';
        const error = io.error ? JSON.stringify(io.error) : '';

        console.log(`\n${task.taskId}`);
        if (options.showInputs && inputs) {
          console.log(`  Inputs: ${truncateValue(inputs, 200, options.noTruncate)}`);
        }
        if (outputs) {
          console.log(`  Outputs: ${truncateValue(outputs, 200, options.noTruncate)}`);
        }
        if (error) {
          console.log(`  Error: ${truncateValue(error, 200, options.noTruncate)}`);
        }
        if (task.retryReasons && task.retryReasons.length > 0) {
          console.log(`  Retries: ${task.retryReasons.map(r => `${r.attempt} (${r.reason})`).join(', ')}`);
        }
      }
    }

    if (timeline && timeline.length > 0) {
      console.log(`\nTimeline:`);
      for (const entry of timeline) {
        const barLength = Math.max(1, Math.round(entry.durationMs / 100));
        console.log(`  ${entry.taskId.padEnd(20)} |${'█'.repeat(barLength)}| ${formatDuration(entry.durationMs)}`);
      }
    }

    if (auditTrail && auditTrail.length > 0) {
      console.log(`\nAudit Trail (${auditTrail.length} events):`);
      for (const event of auditTrail) {
        const timestamp = new Date(event.timestamp).toISOString();
        console.log(`  ${timestamp} ${event.eventType}`);
        if (event.metadata && Object.keys(event.metadata).length > 0) {
          console.log(`    ${truncateValue(JSON.stringify(event.metadata), 200, options.noTruncate)}`);
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

    if (options.json && options.follow) {
      throw new Error('--json cannot be used with --follow');
    }

    // Verify execution exists
    const execution = await stateStore.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const levels = options.level?.flatMap((l) => l.split(',').map(v => v.trim()).filter(Boolean)) || [];
    if (levels.length > 0 && levels.some(level => !LEVELS.has(level))) {
      throw new Error('Invalid log level. Must be one of: DEBUG, INFO, WARN, ERROR');
    }

    const filters: LogQueryFilters = {
      level: levels.length > 0 ? levels : undefined,
      taskId: options.taskId,
      since: options.since ? parseDuration(options.since) : undefined,
    };

    if (options.follow) {
      await streamExecutionLogs(stateStore, logStore, executionId, filters);
      return;
    }

    const allLogs: any[] = [];
    let printedAny = false;
    let offset = 0;
    const limit = 1000;
    while (true) {
      const batch = logStore.getLogsByExecution(executionId, filters, { limit, offset });
      if (batch.length === 0) break;

      if (options.json) {
        allLogs.push(...batch);
      } else {
        printLogBatch(batch);
        printedAny = true;
      }

      if (batch.length < limit) break;
      offset += limit;
    }

    if (options.json) {
      const output = options.pretty ? JSON.stringify(allLogs, null, 2) : JSON.stringify(allLogs);
      console.log(output);
      return;
    }

    if (!printedAny && offset === 0) {
      if (options.taskId) {
        console.log(`No logs found for task ${options.taskId} in execution ${executionId}`);
      } else {
        console.log(`No logs found for execution ${executionId}`);
      }
      return;
    }
  } finally {
    await engine.shutdown();
  }
}

function printLogBatch(logs: Array<{ timestamp: number; level: string; source: string; message: string; taskId?: string }>): void {
  for (const log of logs) {
    const timestamp = new Date(log.timestamp).toISOString();
    const level = formatLogLevel(log.level);
    const source = `[${log.source}]`;
    const taskInfo = log.taskId ? `[${log.taskId}] ` : '';
    const lines = log.message.split('\n');

    if (lines.length > 0) {
      console.log(`${timestamp} ${level} ${source} ${taskInfo}${lines[0]}`);
      for (const line of lines.slice(1)) {
        console.log(`  ${line}`);
      }
    }
  }
}

function formatLogLevel(level: string): string {
  switch (level) {
    case 'ERROR':
      return colorize(level, '31');
    case 'WARN':
      return colorize(level, '33');
    case 'DEBUG':
      return colorize(level, '90');
    default:
      return level;
  }
}

async function streamExecutionLogs(
  stateStore: StateStore,
  logStore: LogStore,
  executionId: string,
  filters: LogQueryFilters
): Promise<void> {
  let stop = false;
  const onSigInt = () => { stop = true; };
  process.on('SIGINT', onSigInt);

  const iterator = logStore.streamLogsByExecution(executionId, filters, 100);
  const interval = setInterval(async () => {
    const execution = await stateStore.getExecution(executionId);
    if (execution && [ExecutionState.SUCCESS, ExecutionState.FAILED, ExecutionState.CANCELLED].includes(execution.state)) {
      stop = true;
      if (iterator.return) {
        await iterator.return();
      }
    }
  }, 100);

  try {
    for await (const log of iterator) {
      if (stop) {
        process.exitCode = 130;
        return;
      }

      printLogBatch([log]);
    }
  } finally {
    clearInterval(interval);
    process.off('SIGINT', onSigInt);
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
