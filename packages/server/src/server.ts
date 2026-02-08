import type { Server } from 'bun';

import { Engine, runtime } from '@autokestra/engine';
import type { Config } from '@autokestra/engine/src/config';
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

  const startedAt = Date.now();
  const app = createApp({
    version: '0.0.1',
    startedAt,
    apiKeys,
    stateStore: engine.getStateStore(),
    db: engine.getDatabase(),
    secretStore,
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
  const pluginPaths = parsePluginPaths();
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
