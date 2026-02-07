import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { SecretStore } from './store.js';

describe('SecretStore', () => {
  let store: SecretStore;
  const testDbPath = join(process.cwd(), 'test-secrets.db');

  beforeEach(() => {
    // Clean up any existing test db
    try {
      unlinkSync(testDbPath);
    } catch {}
    store = new SecretStore(testDbPath);
  });

  afterEach(() => {
    store.close();
    try {
      unlinkSync(testDbPath);
    } catch {}
  });

  it('should set and get a secret', async () => {
    await store.set('TEST_KEY', 'test-value');
    const value = await store.get('TEST_KEY');
    expect(value).toBe('test-value');
  });

  it('should return null for non-existent secret', async () => {
    const value = await store.get('NON_EXISTENT');
    expect(value).toBeNull();
  });

  it('should list secrets', async () => {
    await store.set('KEY1', 'value1');
    await store.set('KEY2', 'value2');

    const secrets = store.list();
    expect(secrets).toHaveLength(2);
    expect(secrets.map(s => s.name).sort()).toEqual(['KEY1', 'KEY2']);
    expect(secrets[0]).toHaveProperty('created_at');
    expect(secrets[0]).toHaveProperty('updated_at');
  });

  it('should delete a secret', async () => {
    await store.set('TEST_KEY', 'test-value');
    expect(await store.get('TEST_KEY')).toBe('test-value');

    const deleted = store.delete('TEST_KEY');
    expect(deleted).toBe(true);
    expect(await store.get('TEST_KEY')).toBeNull();
  });

  it('should return false when deleting non-existent secret', () => {
    const deleted = store.delete('NON_EXISTENT');
    expect(deleted).toBe(false);
  });

  it('should reject invalid secret names', async () => {
    await expect(store.set('invalid name', 'value')).rejects.toThrow('Invalid secret name');
    await expect(store.set('invalid.name', 'value')).rejects.toThrow('Invalid secret name');
    await expect(store.set('123INVALID', 'value')).rejects.toThrow('Invalid secret name');
    // Valid names should not throw
    await store.set('VALID_NAME', 'value');
    await store.set('VALID-NAME', 'value');
    await store.set('valid-name', 'value');
    expect(await store.get('VALID_NAME')).toBe('value');
    expect(await store.get('VALID-NAME')).toBe('value');
    expect(await store.get('valid-name')).toBe('value');
  });
});