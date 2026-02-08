import type { Engine } from '../engine';
import { startCronScheduler } from './cron';
import { runStoredWorkflowOnce } from './workflowRunner';
import type { SecretResolver } from '@autokestra/secrets';

export interface EngineRuntimeOptions {
  engine: Engine;
  pluginPaths: string[];
  silent?: boolean;
  pollIntervalMs?: number;
  /**
   * Optional secret resolver for resolving {{ secrets.* }} templates.
   * When provided (e.g. by the server), ensures a single shared secrets store.
   */
  secretResolver?: SecretResolver;
}

export interface EngineRuntime {
  stop: () => Promise<void>;
}

export function startEngineRuntime(options: EngineRuntimeOptions): EngineRuntime {
  const silent = options.silent ?? false;

  const scheduler = startCronScheduler({
    stateStore: options.engine.getStateStore(),
    silent,
    pollIntervalMs: options.pollIntervalMs,
    onDue: async (wf, scheduledAt) => {
      const executionId = crypto.randomUUID();
      await runStoredWorkflowOnce({
        stateStore: options.engine.getStateStore(),
        db: options.engine.getDatabase(),
        storedWorkflow: wf,
        executionId,
        scheduledAt,
        pluginPaths: options.pluginPaths,
        silent,
        secretResolver: options.secretResolver,
      });
    },
  });

  return {
    stop: () => scheduler.stop(),
  };
}
