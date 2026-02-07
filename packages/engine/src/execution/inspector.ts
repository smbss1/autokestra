import type { StateStore } from '../storage/types';
import { ExecutionState, TaskRunState } from './types';
import { LogStore, AuditEvent } from './logging/store';

export interface ExecutionOverview {
  executionId: string;
  workflowId: string;
  status: ExecutionState;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  reasonCode?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface TaskDetail {
  taskId: string;
  type?: string;
  status: TaskRunState;
  durationMs?: number;
  startedAt?: string;
  endedAt?: string;
  needs?: string[];
  attemptCount?: number;
  retryReasons?: Array<{ attempt: number; reason: string }>;
}

export interface TaskInputsOutputs {
  taskId: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error?: Record<string, any>;
}

export interface TaskTimelineEntry {
  taskId: string;
  startOffsetMs: number;
  endOffsetMs: number;
  durationMs: number;
  status: TaskRunState;
}

export interface ExecutionInspectionResult {
  overview: ExecutionOverview;
  tasks: TaskDetail[];
  auditTrail?: AuditEvent[];
  inputsOutputs?: TaskInputsOutputs[];
  timeline?: TaskTimelineEntry[];
}

const SECRET_KEYS = ['secret', 'password', 'token', 'key'];

function maskSecrets(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (typeof value !== 'object') return value;

  const masked: any = {};
  for (const [key, val] of Object.entries(value)) {
    if (SECRET_KEYS.some((k) => key.toLowerCase().includes(k))) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = maskSecrets(val);
    }
  }

  return masked;
}

export class ExecutionInspector {
  constructor(private stateStore: StateStore, private logStore: LogStore) {}

  async getExecutionOverview(executionId: string): Promise<ExecutionOverview | null> {
    const execution = await this.stateStore.getExecution(executionId);
    if (!execution) return null;

    const start = execution.timestamps.startedAt?.getTime() || execution.timestamps.createdAt.getTime();
    const end = execution.timestamps.endedAt?.getTime();

    return {
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      status: execution.state,
      createdAt: execution.timestamps.createdAt.toISOString(),
      startedAt: execution.timestamps.startedAt?.toISOString(),
      endedAt: execution.timestamps.endedAt?.toISOString(),
      durationMs: end ? end - start : undefined,
      reasonCode: execution.reasonCode,
      message: execution.message,
      metadata: execution.metadata,
    };
  }

  async getTaskDetails(executionId: string): Promise<TaskDetail[]> {
    const taskRuns = await this.stateStore.listTaskRuns({ executionId });
    const execution = await this.stateStore.getExecution(executionId);
    const workflow = execution ? await this.stateStore.getWorkflow(execution.workflowId) : null;

    const taskTypeMap = new Map<string, { type?: string; needs?: string[] }>();
    const tasks = workflow?.definition?.tasks || [];
    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        if (task?.id) {
          taskTypeMap.set(task.id, {
            type: task.type,
            needs: Array.isArray(task.needs) ? task.needs : task.needs ? [task.needs] : [],
          });
        }
      }
    }

    const retryLogs = this.getRetryLogsMap(executionId);

    return taskRuns.items.map((tr) => {
      const taskInfo = taskTypeMap.get(tr.taskId);
      const start = tr.timestamps.startedAt?.getTime();
      const end = tr.timestamps.endedAt?.getTime();
      const duration = tr.durationMs ?? (start && end ? end - start : undefined);
      const retries = retryLogs.get(tr.taskId) || [];
      const maxAttempt = retries.reduce((max, r) => Math.max(max, r.attempt), 1);

      return {
        taskId: tr.taskId,
        type: taskInfo?.type || tr.metadata?.taskType,
        needs: taskInfo?.needs,
        status: tr.state,
        durationMs: duration,
        startedAt: tr.timestamps.startedAt?.toISOString(),
        endedAt: tr.timestamps.endedAt?.toISOString(),
        attemptCount: maxAttempt,
        retryReasons: retries,
      };
    });
  }

  async getTaskInputsOutputs(executionId: string, taskId?: string): Promise<TaskInputsOutputs[]> {
    const taskRuns = await this.stateStore.listTaskRuns({ executionId, taskId });

    return taskRuns.items.map((tr) => ({
      taskId: tr.taskId,
      inputs: tr.inputs ? maskSecrets(tr.inputs) : undefined,
      outputs: tr.outputs ? maskSecrets(tr.outputs) : undefined,
      error: tr.error,
    }));
  }

  getAuditTrail(executionId: string): AuditEvent[] {
    return this.logStore.getAuditTrail(executionId);
  }

  async getTimeline(executionId: string): Promise<TaskTimelineEntry[]> {
    const execution = await this.stateStore.getExecution(executionId);
    const taskRuns = await this.stateStore.listTaskRuns({ executionId });

    if (!execution) return [];

    const base = execution.timestamps.startedAt?.getTime() || execution.timestamps.createdAt.getTime();
    const now = Date.now();

    return taskRuns.items
      .filter((tr) => tr.timestamps.startedAt)
      .map((tr) => {
        const start = tr.timestamps.startedAt?.getTime() || base;
        const end = tr.timestamps.endedAt?.getTime() || now;
        return {
          taskId: tr.taskId,
          startOffsetMs: Math.max(0, start - base),
          endOffsetMs: Math.max(0, end - base),
          durationMs: Math.max(0, end - start),
          status: tr.state,
        };
      })
      .sort((a, b) => a.startOffsetMs - b.startOffsetMs);
  }

  private getRetryLogsMap(executionId: string): Map<string, Array<{ attempt: number; reason: string }>> {
    const retryLogs = new Map<string, Array<{ attempt: number; reason: string }>>();
    const logs = this.logStore.getLogsByExecution(executionId, { level: ['WARN'] });

    for (const log of logs) {
      if (!log.taskId) continue;
      if (!log.message.toLowerCase().includes('retry attempt')) continue;
      const attempt = typeof log.metadata?.attempt === 'number' ? log.metadata.attempt : undefined;
      const reason = typeof log.metadata?.reason === 'string' ? log.metadata.reason : 'unknown';
      if (!attempt) continue;
      if (!retryLogs.has(log.taskId)) {
        retryLogs.set(log.taskId, []);
      }
      retryLogs.get(log.taskId)!.push({ attempt, reason });
    }

    return retryLogs;
  }
}
