// Task executor contract and implementations

import { TaskExecutor } from './interfaces';
import { WorkItem, WorkResult } from './types';
import { PluginExecutor, PluginManager, ProcessRuntime, WorkflowPermissions } from '@autokestra/plugin-runtime';
import type { SecretResolver } from '@autokestra/secrets';
import { LogCollector } from '../execution/logging';

export class WorkflowTaskExecutor implements TaskExecutor {
  private pluginExecutor?: PluginExecutor;
  private secretResolver?: SecretResolver;
  private logCollector?: LogCollector;

  constructor(pluginConfig?: any, secretResolver?: SecretResolver, logCollector?: LogCollector) {
    if (pluginConfig) {
      const manager = new PluginManager(pluginConfig);
      const runtime = new ProcessRuntime(); // Default to trusted
      const permissions: WorkflowPermissions = { security: 'trusted' };
      this.pluginExecutor = new PluginExecutor(manager, runtime, permissions);
    }
    this.secretResolver = secretResolver;
    this.logCollector = logCollector;
  }

  async execute(workItem: WorkItem, signal: AbortSignal): Promise<WorkResult> {
    const start = Date.now();
    const payload = workItem.payload as any;
    const executionId = payload.executionId;
    const taskId = payload.taskId;

    // Log task start
    this.logCollector?.log({
      executionId,
      taskId,
      timestamp: start,
      level: 'INFO',
      source: 'worker',
      message: `Task started: ${payload.type}`,
      metadata: { 
        taskType: payload.type,
        inputs: this.maskSecrets(payload.inputs || {})
      },
    });

    try {
      // Assume payload has type field
      if (payload?.type && this.isPluginTask(payload.type)) {
        if (!this.pluginExecutor) {
          throw new Error('Plugin executor not configured');
        }
        const [namespace, pluginAction] = payload.type.split('/');
        const [pluginName, actionName] = pluginAction.split('.');

        // Resolve secret templates in inputs
        let resolvedInputs = payload.inputs || {};
        if (this.secretResolver) {
          resolvedInputs = this.secretResolver.resolve(resolvedInputs, payload.allowedSecrets);
        }

        const result = await this.pluginExecutor.execute(
          namespace,
          pluginName,
          actionName,
          resolvedInputs,
          { secrets: {}, vars: {}, env: process.env },
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
          level: 'INFO',
          source: 'worker',
          message: `Task completed successfully`,
          metadata: { 
            status: 'SUCCESS',
            duration,
            outputs: this.maskSecrets(result.result)
          },
        });

        return {
          workItemId: workItem.id,
          outcome: 'SUCCESS',
          result: result.result,
          durationMs: duration,
        };
      } else {
        // Handle built-in tasks
        const duration = Date.now() - start;
        // Log task completion
        this.logCollector?.log({
          executionId,
          taskId,
          timestamp: Date.now(),
          level: 'INFO',
          source: 'worker',
          message: `Built-in task completed successfully`,
          metadata: { 
            status: 'SUCCESS',
            duration
          },
        });

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
        level: 'ERROR',
        source: 'worker',
        message: `Task failed: ${(error as Error).message}`,
        metadata: { 
          status: 'FAILED',
          duration,
          error: (error as Error).message,
          stack: (error as Error).stack
        },
      });

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