import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { setSecret, getSecret, listSecrets, deleteSecret } from './secrets.js';

// Mock readline for testing prompts
const mockReadline = {
  question: mock(() => {}),
  close: mock(() => {}),
};

mock.module('readline', () => ({
  createInterface: mock(() => mockReadline),
}));

describe('Secrets CLI Commands', () => {
  const testDbPath = join(process.cwd(), 'test-cli.db');

  beforeEach(() => {
    try {
      unlinkSync(testDbPath);
    } catch {}
    // Set up test database path
    process.env.SECRETS_DB_PATH = testDbPath;
  });

  afterEach(() => {
    try {
      unlinkSync(testDbPath);
    } catch {}
    delete process.env.SECRETS_DB_PATH;
  });

  describe('setSecret', () => {
    it('should set a secret with provided value', async () => {
      await setSecret('test-key', 'test-value');
      // Verify by getting it back
      const value = await getSecret('test-key');
      expect(value).toBe('test-value');
    });

    it('should prompt for value when not provided', async () => {
      mockReadline.question.mockImplementation((query, callback) => {
        callback('prompted-value');
      });

      await setSecret('prompted-key');
      // Verify it was set
      const value = await getSecret('prompted-key');
      expect(value).toBe('prompted-value');
    });
  });

  describe('getSecret', () => {
    it('should get an existing secret', async () => {
      await setSecret('get-test', 'get-value');
      const value = await getSecret('get-test');
      expect(value).toBe('get-value');
    });

    it('should fail for non-existent secret', async () => {
      await expect(getSecret('non-existent')).rejects.toThrow();
    });
  });

  describe('listSecrets', () => {
    it('should list secrets', async () => {
      await setSecret('list-key1', 'value1');
      await setSecret('list-key2', 'value2');

      const secrets = await listSecrets();
      expect(secrets.length).toBe(2);
      expect(secrets.map(s => s.name).sort()).toEqual(['list-key1', 'list-key2']);
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret with confirmation', async () => {
      await setSecret('delete-test', 'delete-value');

      mockReadline.question.mockImplementation((query, callback) => {
        callback('y');
      });

      await deleteSecret('delete-test');
      await expect(getSecret('delete-test')).rejects.toThrow();
    });

    it('should not delete when confirmation denied', async () => {
      await setSecret('no-delete', 'value');

      mockReadline.question.mockImplementation((query, callback) => {
        callback('n');
      });

      await deleteSecret('no-delete');
      const value = await getSecret('no-delete');
      expect(value).toBe('value');
    });

    it('should delete with --force flag', async () => {
      await setSecret('force-delete', 'value');
      await deleteSecret('force-delete', { force: true });
      await expect(getSecret('force-delete')).rejects.toThrow();
    });
  });
});