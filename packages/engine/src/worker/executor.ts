// Task executor contract and implementations

import { TaskExecutor } from './interfaces';
import { WorkItem, WorkResult } from './types';
import { PluginExecutor, PluginManager, ProcessRuntime, WorkflowPermissions } from '@autokestra/plugin-runtime';

export class WorkflowTaskExecutor implements TaskExecutor {
  private pluginExecutor?: PluginExecutor;

  constructor(pluginConfig?: any) {
    if (pluginConfig) {
      const manager = new PluginManager(pluginConfig);
      const runtime = new ProcessRuntime(); // Default to trusted
      const permissions: WorkflowPermissions = { security: 'trusted' };
      this.pluginExecutor = new PluginExecutor(manager, runtime, permissions);
    }
  }

  async execute(workItem: WorkItem, signal: AbortSignal): Promise<WorkResult> {
    const start = Date.now();

    // Assume payload has type field
    const payload = workItem.payload as any;
    if (payload?.type && this.isPluginTask(payload.type)) {
      if (!this.pluginExecutor) {
        throw new Error('Plugin executor not configured');
      }
      const [namespace, pluginAction] = payload.type.split('/');
      const [pluginName, actionName] = pluginAction.split('.');
      try {
        const result = await this.pluginExecutor.execute(
          namespace,
          pluginName,
          actionName,
          payload.inputs || {},
          { secrets: {}, vars: {}, env: process.env }
        );
        return {
          workItemId: workItem.id,
          outcome: 'SUCCESS',
          result: result.result,
          durationMs: Date.now() - start,
        };
      } catch (error) {
        return {
          workItemId: workItem.id,
          outcome: 'FAILED',
          error: error as Error,
          durationMs: Date.now() - start,
        };
      }
    } else {
      // Handle built-in tasks
      return {
        workItemId: workItem.id,
        outcome: 'SUCCESS',
        result: { builtIn: true },
        durationMs: Date.now() - start,
      };
    }
  }

  private isPluginTask(type: string): boolean {
    return type.includes('/') && type.includes('.');
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