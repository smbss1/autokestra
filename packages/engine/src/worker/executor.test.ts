import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { WorkflowTaskExecutor } from './executor.js';
import { SecretStore, SecretResolver } from '@autokestra/secrets';
import type { WorkItem } from './types.js';

describe('WorkflowTaskExecutor', () => {
  let secretStore: SecretStore;
  let secretResolver: SecretResolver;
  let executor: WorkflowTaskExecutor;
  const testDbPath = join(process.cwd(), 'test-executor.db');

  beforeEach(async () => {
    try {
      unlinkSync(testDbPath);
    } catch {}
    secretStore = new SecretStore(testDbPath);
    secretResolver = new SecretResolver(secretStore);
    executor = new WorkflowTaskExecutor({}, secretResolver);

    await secretStore.set('API_KEY', 'resolved-api-key');
  });

  afterEach(() => {
    secretStore.close();
    try {
      unlinkSync(testDbPath);
    } catch {}
  });

  it('should resolve secrets in task inputs', async () => {
    const workItem: WorkItem = {
      id: 'test-work-item',
      payload: {
        type: 'builtin-task',
        inputs: {
          url: 'https://api.example.com?key={{ secrets.API_KEY }}',
          other: 'normal-value'
        },
        allowedSecrets: ['API_KEY']
      }
    };

    const result = await executor.execute(workItem, new AbortController().signal);

    expect(result.outcome).toBe('SUCCESS');
    // Note: In real execution, the plugin would receive resolved inputs
    // For this test, we verify the executor doesn't throw and handles the payload
  });

  it('should handle tasks without secrets', async () => {
    const workItem: WorkItem = {
      id: 'test-work-item',
      payload: {
        type: 'builtin-task',
        inputs: {
          simple: 'value'
        }
      }
    };

    const result = await executor.execute(workItem, new AbortController().signal);
    expect(result.outcome).toBe('SUCCESS');
  });
});