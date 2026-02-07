import type { Server } from 'bun';

import { Engine } from '@autokestra/engine';
import type { Config } from '@autokestra/engine/src/config';

import { createApp } from './app';

export interface StartServerOptions {
  config: Config;
  silent?: boolean;
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

export async function startServer(options: StartServerOptions): Promise<Server> {
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

  const startedAt = Date.now();
  const app = createApp({
    version: '0.0.1',
    startedAt,
    apiKeys,
    stateStore: engine.getStateStore(),
    db: engine.getDatabase(),
  });

  const port = config.server.port;
  const hostname = config.server.host ?? '0.0.0.0';

  const server = Bun.serve({
    port,
    hostname,
    fetch: app.fetch,
  });

  if (!options.silent) {
    // eslint-disable-next-line no-console
    console.log(`Server running at http://${hostname}:${port}`);
  }

  return server;
}
