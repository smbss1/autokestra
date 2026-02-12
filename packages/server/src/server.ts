import type { Server } from 'bun';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Engine, runtime } from '@autokestra/engine';
import type { Config } from '@autokestra/engine/src/config';
import { runStoredWorkflowOnce } from '@autokestra/engine/src/runtime/workflowRunner';
import { SecretResolver, SecretStore } from '@autokestra/secrets';

import { createApp } from './app';

function parsePluginPaths(): string[] {
  const raw = process.env.AUTOKESTRA_PLUGIN_PATHS;
  if (!raw) return ["./plugins"];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listPluginDirs(pluginPaths: string[]): Promise<string[]> {
  const dirs: string[] = [];

  for (const base of pluginPaths) {
    const absBase = path.resolve(base);
    if (!(await pathExists(absBase))) continue;

    const entries = await fs.readdir(absBase, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      dirs.push(path.join(absBase, entry.name));
    }
  }

  return dirs;
}

async function runBunInstall(cwd: string): Promise<{ code: number; stderr: string }> {
  const proc = Bun.spawn(['bun', 'install'], {
    cwd,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'pipe',
    env: process.env,
  });

  const [stderr, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { code, stderr };
}

async function hasWorkspaceDependencies(packageJsonPath: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw) as any;
    const sections = [pkg?.dependencies, pkg?.devDependencies, pkg?.optionalDependencies, pkg?.peerDependencies];
    for (const section of sections) {
      if (!section || typeof section !== 'object') continue;
      for (const value of Object.values(section)) {
        if (typeof value === 'string' && value.startsWith('workspace:')) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface StartServerOptions {
  config: Config;
  silent?: boolean;
}

export interface ManagedServer {
  server: Server<any>;
  /**
   * Gracefully stops accepting traffic, closes resources, and shuts down the Engine.
   * Safe to call multiple times.
   */
  shutdown: (reason?: string) => Promise<void>;
  /** Resolves once shutdown has completed. */
  waitForShutdown: () => Promise<void>;
}

export interface StartManagedServerOptions extends StartServerOptions {
  /**
   * When true, installs SIGINT/SIGTERM handlers that trigger graceful shutdown.
   * Default: true (server process use-case).
   */
  handleSignals?: boolean;
}

function requireApiKeys(config: Config): string[] {
  const apiKeys = config.server.apiKeys;
  if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
    throw new Error('Server API keys are required. Set server.apiKeys in your YAML config.');
  }
  const normalized = apiKeys.map((k) => String(k).trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error('Server API keys are required. Set non-empty values in server.apiKeys.');
  }
  return normalized;
}

export async function startServer(options: StartServerOptions): Promise<Server<any>> {
  const managed = await startManagedServer({ ...options, handleSignals: false });
  return managed.server;
}

export async function startManagedServer(options: StartManagedServerOptions): Promise<ManagedServer> {
  const { config } = options;

  const apiKeys = requireApiKeys(config);

  if (config.storage.type !== 'sqlite') {
    throw new Error(`Only sqlite storage is supported by the server right now (got '${config.storage.type}').`);
  }

  const engine = new Engine({
    storage: { path: config.storage.path, retentionDays: config.storage.retentionDays },
    silent: options.silent ?? false,
    logRetentionDays: config.storage.retentionDays,
  });

  await engine.initialize();

  // Secret store lives in the server process, but is considered part of the engine runtime surface.
  // The CLI must never access secrets locally.
  const secretStore = new SecretStore();
  const secretResolver = new SecretResolver(secretStore);
  const pluginPaths = parsePluginPaths();

  const startedAt = Date.now();
  const app = createApp({
    version: '0.0.1',
    startedAt,
    apiKeys,
    stateStore: engine.getStateStore(),
    db: engine.getDatabase(),
    secretStore,
    triggerWorkflowExecution: async ({ workflowId, executionId }) => {
      const storedWorkflow = await engine.getStateStore().getWorkflow(workflowId);
      if (!storedWorkflow) {
        throw new Error(`Workflow '${workflowId}' not found`);
      }

      void runStoredWorkflowOnce({
        stateStore: engine.getStateStore(),
        db: engine.getDatabase(),
        storedWorkflow,
        executionId,
        triggerType: 'manual',
        pluginPaths,
        silent: options.silent ?? false,
        secretResolver,
      }).catch((error) => {
        if (!options.silent) {
          // eslint-disable-next-line no-console
          console.error(`Manual workflow trigger failed for '${workflowId}' (${executionId}):`, error);
        }
      });
    },
    preparePluginDependencies: async ({ name }) => {
      const allPluginDirs = await listPluginDirs(pluginPaths);
      const selected = name
        ? allPluginDirs.filter((dir) => path.basename(dir) === name)
        : allPluginDirs;

      if (selected.length === 0) {
        return { prepared: [], skipped: [], found: false };
      }

      const prepared: string[] = [];
      const skipped: string[] = [];

      for (const pluginDir of selected) {
        const pkgJson = path.join(pluginDir, 'package.json');
        if (!(await pathExists(pkgJson))) {
          skipped.push(path.basename(pluginDir));
          continue;
        }

        if (await hasWorkspaceDependencies(pkgJson)) {
          skipped.push(path.basename(pluginDir));
          continue;
        }

        const result = await runBunInstall(pluginDir);
        if (result.code !== 0) {
          const details = result.stderr.trim();
          throw new Error(
            details
              ? `Failed to install dependencies for plugin '${path.basename(pluginDir)}': ${details}`
              : `Failed to install dependencies for plugin '${path.basename(pluginDir)}'`,
          );
        }

        prepared.push(path.basename(pluginDir));
      }

      return { prepared, skipped, found: true };
    },
  });

  const port = config.server.port;
  const hostname = config.server.host ?? '0.0.0.0';

  const server = Bun.serve({
    port,
    hostname,
    fetch: app.fetch,
  });

  // Start the engine runtime (scheduling + execution). The server itself stays thin.
  const runtimeDisabled = process.env.AUTOKESTRA_DISABLE_RUNTIME === '1';
  const engineRuntime = runtimeDisabled
    ? undefined
    : runtime.startEngineRuntime({
        engine,
        pluginPaths,
        silent: options.silent ?? false,
        secretResolver,
      });

  if (!options.silent) {
    // eslint-disable-next-line no-console
    console.log(`Server running at http://${hostname}:${port}`);
  }

  let shutdownResolve: (() => void) | undefined;
  const shutdownDone = new Promise<void>((resolve) => {
    shutdownResolve = resolve;
  });

  let shuttingDown = false;
  const shutdown = async (reason?: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (!options.silent) {
      // eslint-disable-next-line no-console
      console.log(reason ? `Shutting down server (${reason})...` : 'Shutting down server...');
    }

    try {
      // Stop accepting new connections.
      // Bun supports stop([closeActiveConnections]). Keep it compatible.
      (server as any).stop?.(true);
    } catch {
      // best-effort
    }

    try {
      await engineRuntime?.stop();
    } catch {
      // best-effort
    }

    try {
      await engine.shutdown();
    } finally {
      try {
        secretStore.close();
      } catch {
        // best-effort
      }
      shutdownResolve?.();
    }
  };

  const handleSignals = options.handleSignals ?? true;
  const onSigInt = () => void shutdown('SIGINT');
  const onSigTerm = () => void shutdown('SIGTERM');

  if (handleSignals) {
    process.on('SIGINT', onSigInt);
    process.on('SIGTERM', onSigTerm);

    shutdownDone.finally(() => {
      process.off('SIGINT', onSigInt);
      process.off('SIGTERM', onSigTerm);
    });
  }

  return {
    server,
    shutdown,
    waitForShutdown: () => shutdownDone,
  };
}
