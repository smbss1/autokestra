// Task executor contract and implementations

import { TaskExecutor } from './interfaces';
import { WorkItem, WorkResult } from './types';
import { PluginExecutor, PluginManager, ProcessRuntime, WorkflowPermissions } from '@autokestra/plugin-runtime';
import type { SecretResolver } from '@autokestra/secrets';
import { LogCollector, LogLevel } from '../execution/logging';
import type { StateStore } from '../storage/types';

export class WorkflowTaskExecutor implements TaskExecutor {
  private pluginExecutor?: PluginExecutor;
  private secretResolver?: SecretResolver;
  private logCollector?: LogCollector;
  private stateStore?: StateStore;

  constructor(pluginConfig?: any, secretResolver?: SecretResolver, logCollector?: LogCollector, stateStore?: StateStore) {
    if (pluginConfig) {
      const manager = new PluginManager(pluginConfig);
      const runtime = new ProcessRuntime(); // Default to trusted
      const permissions: WorkflowPermissions = { security: 'trusted' };
      this.pluginExecutor = new PluginExecutor(manager, runtime, permissions);
    }
    this.secretResolver = secretResolver;
    this.logCollector = logCollector;
    this.stateStore = stateStore;
  }

  async execute(workItem: WorkItem, signal: AbortSignal): Promise<WorkResult> {
    const start = Date.now();
    const payload = workItem.payload as any;
    const executionId = payload.executionId;
    const taskId = payload.taskId;

    if (workItem.attempt > 1) {
      const retryReason = payload?.retryReason || payload?.lastError || payload?.error || 'unknown';
      this.logCollector?.log({
        executionId,
        taskId,
        timestamp: Date.now(),
        level: LogLevel.WARN,
        source: 'worker',
        message: `Task retry attempt ${workItem.attempt}`,
        metadata: {
          attempt: workItem.attempt,
          reason: retryReason,
        },
      });
    }

    const maskedInputs = this.maskSecrets(payload.inputs || {});

    // Resolve secret templates in inputs (applies to both plugin and built-in tasks).
    let resolvedInputs = payload.inputs || {};
    if (this.secretResolver) {
      resolvedInputs = await this.secretResolver.resolve(resolvedInputs, payload.allowedSecrets);
    }

    // Log task start
    this.logCollector?.log({
      executionId,
      taskId,
      timestamp: start,
      level: LogLevel.INFO,
      source: 'worker',
      message: `Task started: ${payload.type}`,
      metadata: { 
        taskType: payload.type,
        inputs: maskedInputs
      },
    });

    await this.updateTaskRunOnStart(executionId, taskId, payload.type, maskedInputs);

    try {
      // Assume payload has type field
      if (payload?.type && this.isPluginTask(payload.type)) {
        if (!this.pluginExecutor) {
          throw new Error('Plugin executor not configured');
        }
        const [namespace, pluginAction] = payload.type.split('/');
        const [pluginName, actionName] = pluginAction.split('.');

        // Build template context for resolving {{ tasks.* }} references.
        // This is best-effort and based on persisted task runs.
        let tasksContext: Record<string, any> | undefined;
        if (this.stateStore && executionId) {
          try {
            const taskRuns = await this.stateStore.listTaskRuns({ executionId, limit: 1000, offset: 0 });
            tasksContext = {};
            for (const tr of taskRuns.items) {
              (tasksContext as any)[tr.taskId] = {
                output: tr.outputs,
                outputs: tr.outputs,
                state: tr.state,
              };
            }
          } catch {
            // ignore - template context will just omit tasks
          }
        }

        const result = await this.pluginExecutor.execute(
          namespace,
          pluginName,
          actionName,
          resolvedInputs,
          { secrets: {}, vars: {}, env: process.env as Record<string, string>, ...(tasksContext ? { tasks: tasksContext } : {}) },
          undefined, // timeoutMs
          this.logCollector ? {
            logCollector: this.logCollector,
            executionId,
            taskId
          } : undefined
        );
        
        const duration = Date.now() - start;
        // Log task completion
        this.logCollector?.log({
          executionId,
          taskId,
          timestamp: Date.now(),
          level: LogLevel.INFO,
          source: 'worker',
          message: `Task completed successfully`,
          metadata: { 
            status: 'SUCCESS',
            duration,
            outputs: this.maskSecrets(result.result)
          },
        });

        await this.updateTaskRunOnSuccess(executionId, taskId, duration, this.maskSecrets(result.result));

        return {
          workItemId: workItem.id,
          outcome: 'SUCCESS',
          result: result.result,
          durationMs: duration,
        };
      } else {
        // Handle built-in tasks
        const duration = Date.now() - start;

        // For built-in tasks we currently don't execute anything, but we still
        // validate/resolve inputs so secret templates behave consistently.
        void resolvedInputs;

        // Log task completion
        this.logCollector?.log({
          executionId,
          taskId,
          timestamp: Date.now(),
          level: LogLevel.INFO,
          source: 'worker',
          message: `Built-in task completed successfully`,
          metadata: { 
            status: 'SUCCESS',
            duration
          },
        });

        await this.updateTaskRunOnSuccess(executionId, taskId, duration, { builtIn: true });

        return {
          workItemId: workItem.id,
          outcome: 'SUCCESS',
          result: { builtIn: true },
          durationMs: duration,
        };
      }
    } catch (error) {
      const duration = Date.now() - start;
      // Log task failure
      this.logCollector?.log({
        executionId,
        taskId,
        timestamp: Date.now(),
        level: LogLevel.ERROR,
        source: 'worker',
        message: `Task failed: ${(error as Error).message}`,
        metadata: { 
          status: 'FAILED',
          duration,
          error: (error as Error).message,
          stack: (error as Error).stack
        },
      });

      await this.updateTaskRunOnFailure(executionId, taskId, duration, error as Error);

      return {
        workItemId: workItem.id,
        outcome: 'FAILED',
        error: error as Error,
        durationMs: duration,
      };
    }
  }

  private isPluginTask(type: string): boolean {
    return type.includes('/') && type.includes('.');
  }

  private maskSecrets(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSecrets(item));
    }
    
    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        masked[key] = '***MASKED***';
      } else {
        masked[key] = this.maskSecrets(value);
      }
    }
    return masked;
  }

  private async updateTaskRunOnStart(
    executionId: string,
    taskId: string,
    taskType: string,
    inputs: Record<string, any>
  ): Promise<void> {
    if (!this.stateStore) return;

    const taskRun = await this.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) return;

    taskRun.inputs = inputs;
    taskRun.metadata = {
      ...taskRun.metadata,
      taskType,
    };
    taskRun.timestamps.updatedAt = new Date();

    await this.stateStore.updateTaskRun(taskRun);
  }

  private async updateTaskRunOnSuccess(
    executionId: string,
    taskId: string,
    durationMs: number,
    outputs: Record<string, any>
  ): Promise<void> {
    if (!this.stateStore) return;

    const taskRun = await this.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) return;

    taskRun.outputs = outputs;
    taskRun.durationMs = durationMs;
    taskRun.timestamps.updatedAt = new Date();

    await this.stateStore.updateTaskRun(taskRun);
  }

  private async updateTaskRunOnFailure(
    executionId: string,
    taskId: string,
    durationMs: number,
    error: Error
  ): Promise<void> {
    if (!this.stateStore) return;

    const taskRun = await this.stateStore.getTaskRun(executionId, taskId);
    if (!taskRun) return;

    taskRun.error = {
      message: error.message,
      stack: error.stack,
    };
    taskRun.durationMs = durationMs;
    taskRun.timestamps.updatedAt = new Date();

    await this.stateStore.updateTaskRun(taskRun);
  }
}

export class TestTaskExecutor implements TaskExecutor {
  constructor(private simulateDurationMs: number = 100, private outcome: 'SUCCESS' | 'FAILED' = 'SUCCESS') {}

  async execute(workItem: WorkItem, signal: AbortSignal): Promise<WorkResult> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({
          workItemId: workItem.id,
          outcome: this.outcome,
          result: { simulated: true },
          durationMs: Date.now() - start,
        });
      }, this.simulateDurationMs);

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('CANCELLED'));
      });
    });
  }
}