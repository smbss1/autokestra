import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import net from 'node:net';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, unlinkSync, existsSync } from 'fs';

import { startManagedServer } from '@autokestra/server';

import { setSecret, getSecret, listSecrets, deleteSecret } from './secrets';

// Mock readline for testing prompts
const mockReadline = {
  question: mock((query, callback) => {}),
  close: mock(() => {}),
};

mock.module('readline', () => ({
  createInterface: mock(() => mockReadline),
}));

describe('Secrets CLI Commands', () => {
  let dir = '';
  let testSecretsDbPath = '';
  let baseUrl = '';
  const apiKey = 'test-key';
  let shutdownServer: (() => Promise<void>) | undefined;

  async function getFreePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        server.close(() => resolve(port));
      });
    });
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-secrets-'));
    testSecretsDbPath = join(dir, 'secrets.db');
    if (existsSync(testSecretsDbPath)) unlinkSync(testSecretsDbPath);

    // Ensure tests don't touch ~/.autokestra/secret.key
    process.env.AUTOKESTRA_SECRET_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SECRETS_DB_PATH = testSecretsDbPath;

    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    const previousDisable = process.env.AUTOKESTRA_DISABLE_RUNTIME;
    process.env.AUTOKESTRA_DISABLE_RUNTIME = '1';

    const managed = await startManagedServer({
      config: {
        server: { port, host: '127.0.0.1', apiKeys: [apiKey] },
        storage: { type: 'sqlite', path: join(dir, 'db.sqlite'), retentionDays: 30 },
        execution: { maxConcurrentWorkflows: 1, maxConcurrentTasks: 1, defaultTimeoutSeconds: 60 },
      },
      silent: true,
      handleSignals: false,
    });

    shutdownServer = async () => {
      await managed.shutdown('test');
      process.env.AUTOKESTRA_DISABLE_RUNTIME = previousDisable;
    };
  });

  afterEach(async () => {
    await shutdownServer?.();
    shutdownServer = undefined;
    if (existsSync(testSecretsDbPath)) unlinkSync(testSecretsDbPath);
    delete process.env.SECRETS_DB_PATH;
    delete process.env.AUTOKESTRA_SECRET_KEY;
  });

  describe('setSecret', () => {
    it('should set a secret with provided value', async () => {
      await setSecret({ api: { baseUrl, apiKey } }, 'test-key', 'test-value');
      const value = await getSecret({ api: { baseUrl, apiKey } }, 'test-key');
      expect(value).toBe('test-value');
    });

    it('should prompt for value when not provided', async () => {
      mockReadline.question.mockImplementation((query, callback) => {
        callback('prompted-value');
      });

      await setSecret({ api: { baseUrl, apiKey } }, 'prompted-key');
      const value = await getSecret({ api: { baseUrl, apiKey } }, 'prompted-key');
      expect(value).toBe('prompted-value');
    });
  });

  describe('getSecret', () => {
    it('should get an existing secret', async () => {
      await setSecret({ api: { baseUrl, apiKey } }, 'get-test', 'get-value');
      const value = await getSecret({ api: { baseUrl, apiKey } }, 'get-test');
      expect(value).toBe('get-value');
    });

    it('should fail for non-existent secret', async () => {
      await expect(getSecret({ api: { baseUrl, apiKey } }, 'non-existent')).rejects.toThrow();
    });
  });

  describe('listSecrets', () => {
    it('should list secrets', async () => {
      await setSecret({ api: { baseUrl, apiKey } }, 'list-key1', 'value1');
      await setSecret({ api: { baseUrl, apiKey } }, 'list-key2', 'value2');

      const originalLog = console.log;
      console.log = () => {};

      let secrets: any[] = [];
      try {
        secrets = await listSecrets({ api: { baseUrl, apiKey } }, {});
      } finally {
        console.log = originalLog;
      }

      expect(secrets.length).toBe(2);
      expect(secrets.map(s => s.name).sort()).toEqual(['list-key1', 'list-key2']);
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret with confirmation', async () => {
      await setSecret({ api: { baseUrl, apiKey } }, 'delete-test', 'delete-value');

      mockReadline.question.mockImplementation((query, callback) => {
        callback('y');
      });

      await deleteSecret({ api: { baseUrl, apiKey } }, 'delete-test');
      await expect(getSecret({ api: { baseUrl, apiKey } }, 'delete-test')).rejects.toThrow();
    });

    it('should not delete when confirmation denied', async () => {
      await setSecret({ api: { baseUrl, apiKey } }, 'no-delete', 'value');

      mockReadline.question.mockImplementation((query, callback) => {
        callback('n');
      });

      await deleteSecret({ api: { baseUrl, apiKey } }, 'no-delete');
      const value = await getSecret({ api: { baseUrl, apiKey } }, 'no-delete');
      expect(value).toBe('value');
    });

    it('should delete with --force flag', async () => {
      await setSecret({ api: { baseUrl, apiKey } }, 'force-delete', 'value');
      await deleteSecret({ api: { baseUrl, apiKey } }, 'force-delete', { force: true });
      await expect(getSecret({ api: { baseUrl, apiKey } }, 'force-delete')).rejects.toThrow();
    });
  });
});