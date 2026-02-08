// CLI commands for execution management (server API client)

import { ExecutionState, TaskRunState } from '@autokestra/engine/src/execution/types';
import { ApiClientConfig, ApiError, requestJson } from '../apiClient';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR']);

export interface CliConfig {
  api: ApiClientConfig;
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

type ExecutionListItemDto = {
  executionId: string;
  workflowId: string;
  state: ExecutionState;
  reasonCode?: string;
  message?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  updatedAt: string;
};

type ExecutionListResponseDto = {
  executions: ExecutionListItemDto[];
  total: number;
  limit: number;
  offset: number;
};

type ExecutionLogsItemDto = {
  id: number;
  executionId: string;
  taskId?: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: unknown;
};

type ExecutionLogsResponseDto = {
  items: ExecutionLogsItemDto[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

function isTty(): boolean {
  return Boolean(process.stdout.isTTY);
}

function colorize(text: string, colorCode: string): string {
  if (!isTty()) return text;
  return `\u001b[${colorCode}m${text}\u001b[0m`;
}

function formatStatus(status: TaskRunState | ExecutionState): string {
  switch (status) {
    case ExecutionState.SUCCESS:
    case TaskRunState.SUCCESS:
      return colorize(status, '32');
    case ExecutionState.FAILED:
    case TaskRunState.FAILED:
      return colorize(status, '31');
    case ExecutionState.RUNNING:
    case TaskRunState.RUNNING:
      return colorize(status, '33');
    case ExecutionState.PENDING:
    case TaskRunState.PENDING:
      return colorize(status, '90');
    default:
      return status;
  }
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

function formatLogLevel(level: LogLevel): string {
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

function normalizeLevels(levels?: string[]): LogLevel[] | undefined {
  const normalized = (levels || [])
    .flatMap((l) => l.split(',').map((v) => v.trim()).filter(Boolean))
    .map((l) => l.toUpperCase() as LogLevel);

  if (normalized.length === 0) return undefined;
  if (normalized.some((l) => !LEVELS.has(l))) {
    throw new Error('Invalid log level. Must be one of: DEBUG, INFO, WARN, ERROR');
  }
  return normalized;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid time format. Examples: 5m, 2h, 1d');
  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error('Invalid duration unit');
  }
}

export async function cleanupExecutions(config: CliConfig, options: ExecutionCleanupOptions = {}): Promise<void> {
  const days = options.days ?? 30;
  const states = options.states;
  const dryRun = Boolean(options.dryRun);

  const result = await requestJson<any>(config.api, 'POST', '/api/v1/executions/cleanup', {
    body: { days, states, dryRun },
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (dryRun) {
    console.log(`Dry run: Would delete ${result.wouldDelete ?? 0} executions older than ${result.cutoffDate}`);
    if (Array.isArray(result.states) && result.states.length > 0) {
      console.log(`States: ${result.states.join(', ')}`);
    }
    return;
  }

  console.log(`Deleted ${result.deleted ?? 0} executions older than ${result.cutoffDate}`);
  if (Array.isArray(result.states) && result.states.length > 0) {
    console.log(`States: ${result.states.join(', ')}`);
  }
}

export async function listExecutions(config: CliConfig, options: ExecutionListOptions = {}): Promise<void> {
  const result = await requestJson<ExecutionListResponseDto>(config.api, 'GET', '/api/v1/executions', {
    query: {
      workflowId: options.workflowId,
      state: options.state,
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    },
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.executions.length === 0) {
    console.log('No executions found');
    return;
  }

  console.log(`Found ${result.total} execution(s):\n`);
  for (const exec of result.executions) {
    const created = Date.parse(exec.createdAt);
    const ended = exec.endedAt ? Date.parse(exec.endedAt) : undefined;
    const duration = ended && Number.isFinite(created) ? `${ended - created}ms` : exec.endedAt ? '-' : 'ongoing';
    console.log(`  ${exec.executionId} [${exec.state}] - workflow: ${exec.workflowId} - duration: ${duration}`);
  }
}

export async function inspectExecution(config: CliConfig, executionId: string, options: ExecutionInspectOptions = {}): Promise<void> {
  let inspection: any;
  try {
    inspection = await requestJson<any>(config.api, 'GET', `/api/v1/executions/${encodeURIComponent(executionId)}`, {
      query: {
        includeInputsOutputs: options.showInputs ? true : undefined,
        includeAuditTrail: options.audit ? true : undefined,
        includeTimeline: options.timeline ? true : undefined,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    throw error;
  }

  const overview = inspection.overview;
  const tasks = Array.isArray(inspection.tasks) ? inspection.tasks : [];
  const inputsOutputs = Array.isArray(inspection.inputsOutputs) ? inspection.inputsOutputs : undefined;
  const auditTrail = Array.isArray(inspection.auditTrail) ? inspection.auditTrail : undefined;
  const timeline = Array.isArray(inspection.timeline) ? inspection.timeline : undefined;

  if (options.json) {
    const output = {
      execution: overview,
      tasks,
      ...(inputsOutputs ? { inputsOutputs } : {}),
      ...(auditTrail ? { auditTrail } : {}),
      ...(timeline ? { timeline } : {}),
    };
    console.log(options.pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output));
    return;
  }

  console.log(`\nExecution: ${overview.executionId}`);
  console.log(`Workflow: ${overview.workflowId}`);
  console.log(`State: ${formatStatus(overview.status)}`);
  if (overview.reasonCode) console.log(`Reason: ${overview.reasonCode}`);
  if (overview.message) console.log(`Message: ${overview.message}`);
  console.log(`Created: ${overview.createdAt}`);
  if (overview.startedAt) console.log(`Started: ${overview.startedAt}`);
  if (overview.endedAt) console.log(`Ended: ${overview.endedAt}`);
  console.log(`Duration: ${formatDuration(overview.durationMs)}`);

  if (tasks.length > 0) {
    console.log(`\nTasks (${tasks.length}):`);
    const headers = ['Task ID', 'Type', 'Status', 'Duration', 'Start', 'End'];
    const rows = tasks.map((task: any) => [
      String(task.taskId),
      String(task.type || '-'),
      task.status === TaskRunState.RUNNING ? `⏳ ${formatStatus(task.status)}` : formatStatus(task.status),
      formatDuration(task.durationMs),
      String(task.startedAt || '-'),
      String(task.endedAt || '-'),
    ]);
    const columnWidths = headers.map((header, index) => Math.max(header.length, ...rows.map((row: any) => row[index].length)));
    const formatRow = (row: string[]) => row.map((cell, i) => cell.padEnd(columnWidths[i])).join('  ');

    console.log(formatRow(headers));
    console.log(columnWidths.map((w) => '-'.repeat(w)).join('  '));
    for (const row of rows) console.log(formatRow(row));
  }

  if (options.showInputs && inputsOutputs && inputsOutputs.length > 0) {
    console.log(`\nTask Inputs/Outputs:`);
    for (const io of inputsOutputs) {
      console.log(`\n  Task: ${io.taskId}`);
      if (io.inputs) console.log(`    Inputs: ${truncateValue(JSON.stringify(io.inputs), 200, options.noTruncate)}`);
      if (io.outputs) console.log(`    Outputs: ${truncateValue(JSON.stringify(io.outputs), 200, options.noTruncate)}`);
      if (io.error) console.log(`    Error: ${truncateValue(JSON.stringify(io.error), 200, options.noTruncate)}`);
    }
  }

  if (options.timeline && timeline) {
    console.log(`\nTimeline:`);
    for (const entry of timeline) {
      console.log(
        `  ${entry.taskId}: ${entry.startOffsetMs}ms -> ${entry.endOffsetMs}ms (${entry.durationMs}ms) [${entry.status}]`,
      );
    }
  }

  if (options.audit && auditTrail) {
    console.log(`\nAudit Trail:`);
    for (const event of auditTrail) {
      console.log(`  [${new Date(event.timestamp).toISOString()}] ${event.action}: ${event.details || ''}`);
    }
  }
}

function printLogBatch(logs: ExecutionLogsItemDto[]): void {
  for (const log of logs) {
    const timestamp = new Date(log.timestamp).toISOString();
    const level = formatLogLevel(log.level);
    const source = `[${log.source}]`;
    const taskInfo = log.taskId ? `[${log.taskId}] ` : '';
    const lines = String(log.message || '').split('\n');
    if (lines.length > 0) {
      console.log(`${timestamp} ${level} ${source} ${taskInfo}${lines[0]}`);
      for (const line of lines.slice(1)) console.log(`  ${line}`);
    }
  }
}

async function fetchLogsPage(
  config: CliConfig,
  executionId: string,
  options: ExecutionLogsOptions,
  paging: { limit: number; offset: number },
): Promise<ExecutionLogsResponseDto> {
  const levels = normalizeLevels(options.level);
  const query: Record<string, any> = {
    limit: paging.limit,
    offset: paging.offset,
    taskId: options.taskId,
  };

  // Server accepts repeated level params or comma-separated; keep it simple.
  if (levels && levels.length > 0) {
    query.level = levels.join(',');
  }

  return await requestJson<ExecutionLogsResponseDto>(
    config.api,
    'GET',
    `/api/v1/executions/${encodeURIComponent(executionId)}/logs`,
    { query },
  );
}

export async function getExecutionLogs(config: CliConfig, executionId: string, options: ExecutionLogsOptions = {}): Promise<void> {
  if (options.json && options.follow) {
    throw new Error('--json cannot be used with --follow');
  }

  const sinceMs = options.since ? parseDuration(options.since) : undefined;
  const cutoff = sinceMs ? Date.now() - sinceMs : undefined;

  if (options.follow) {
    const seen = new Set<number>();
    // Prime with a first fetch.
    while (true) {
      const page = await fetchLogsPage(config, executionId, options, { limit: 200, offset: 0 });
      const newOnes = page.items
        .filter((i) => !seen.has(i.id))
        .filter((i) => (cutoff ? i.timestamp >= cutoff : true))
        .sort((a, b) => a.timestamp - b.timestamp);

      for (const item of newOnes) seen.add(item.id);
      if (newOnes.length > 0) printLogBatch(newOnes);

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const all: ExecutionLogsItemDto[] = [];
  let printedAny = false;
  let offset = 0;
  const limit = 1000;

  while (true) {
    const page = await fetchLogsPage(config, executionId, options, { limit, offset });
    const items = page.items
      .filter((i) => (cutoff ? i.timestamp >= cutoff : true))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (page.items.length === 0) break;

    if (options.json) {
      all.push(...items);
    } else {
      if (items.length > 0) {
        printLogBatch(items);
        printedAny = true;
      }
    }

    if (!page.hasMore) break;
    offset += limit;
  }

  if (options.json) {
    console.log(options.pretty ? JSON.stringify(all, null, 2) : JSON.stringify(all));
    return;
  }

  if (!printedAny) {
    if (options.taskId) {
      console.log(`No logs found for task ${options.taskId} in execution ${executionId}`);
    } else {
      console.log(`No logs found for execution ${executionId}`);
    }
  }
}
