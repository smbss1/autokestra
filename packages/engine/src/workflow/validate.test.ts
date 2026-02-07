import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { validateWorkflow } from './validate.js';
import type { Workflow } from './model.js';
import { SecretStore } from '@autokestra/secrets';

describe('validateWorkflow', () => {
  let secretStore: SecretStore;
  const testDbPath = join(process.cwd(), 'test-validate.db');

  beforeEach(async () => {
    try {
      unlinkSync(testDbPath);
    } catch {}
    secretStore = new SecretStore(testDbPath);
    await secretStore.set('EXISTING_SECRET', 'value');
  });

  afterEach(() => {
    secretStore.close();
    try {
      unlinkSync(testDbPath);
    } catch {}
  });

  it('should pass validation for workflow with existing secrets', async () => {
    const workflow: Workflow = {
      apiVersion: 'v1',
      id: 'test-workflow',
      enabled: true,
      secrets: ['EXISTING_SECRET'],
      tasks: [{
        id: 'task1',
        type: 'example/plugin.action',
        needs: []
      }],
      source: { filePath: 'test.yaml' },
    };

    await expect(validateWorkflow(workflow, { secretStore })).resolves.toBeUndefined();
  });

  it('should fail validation for workflow with missing secret', async () => {
    const workflow: Workflow = {
      apiVersion: 'v1',
      id: 'test-workflow',
      enabled: true,
      secrets: ['MISSING_SECRET'],
      tasks: [{
        id: 'task1',
        type: 'example/plugin.action',
        needs: []
      }],
      source: { filePath: 'test.yaml' },
    };

    await expect(validateWorkflow(workflow, { secretStore })).rejects.toThrow('Declared secret \'MISSING_SECRET\' not found');
  });

  it('should pass validation when secret exists as environment variable', async () => {
    const originalEnv = process.env.ENV_SECRET;
    process.env.ENV_SECRET = 'env-value';

    try {
      const workflow: Workflow = {
        apiVersion: 'v1',
        id: 'test-workflow',
        enabled: true,
        secrets: ['ENV_SECRET'],
        tasks: [{
          id: 'task1',
          type: 'example/plugin.action',
          needs: []
        }],
        source: { filePath: 'test.yaml' },
      };

      await expect(validateWorkflow(workflow, { secretStore })).resolves.toBeUndefined();
    } finally {
      process.env.ENV_SECRET = originalEnv;
    }
  });

  it('should pass validation for workflow without secrets', async () => {
    const workflow: Workflow = {
      apiVersion: 'v1',
      id: 'test-workflow',
      enabled: true,
      tasks: [{
        id: 'task1',
        type: 'example/plugin.action',
        needs: []
      }],
      source: { filePath: 'test.yaml' },
    };

    await expect(validateWorkflow(workflow, { secretStore })).resolves.toBeUndefined();
  });
});