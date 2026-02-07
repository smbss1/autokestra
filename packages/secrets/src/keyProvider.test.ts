import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { unlinkSync, existsSync, rmdirSync, writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MasterKeyProvider } from './keyProvider.js';

describe('MasterKeyProvider', () => {
  let provider: MasterKeyProvider;
  let tempDir: string;
  let keyFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autokestra-test-'));
    keyFilePath = join(tempDir, 'secret.key');
    provider = new MasterKeyProvider(keyFilePath);
    provider.clearCache();
  });

  afterEach(() => {
    try {
      unlinkSync(keyFilePath);
    } catch {}
    try {
      rmdirSync(tempDir);
    } catch {}
  });

  it('should use environment variable when set', () => {
    const originalEnv = process.env.AUTOKESTRA_SECRET_KEY;
    process.env.AUTOKESTRA_SECRET_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    try {
      const key = provider.getKey();
      expect(key).toEqual(Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'));
    } finally {
      process.env.AUTOKESTRA_SECRET_KEY = originalEnv;
    }
  });

  it('should use key file when env not set', () => {
    const testKey = Buffer.from('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210', 'hex');
    // Pre-create key file
    require('fs').writeFileSync(keyFilePath, testKey);

    const key = provider.getKey();
    expect(key).toEqual(testKey);
  });

  it('should generate and save key file when neither env nor file exists', () => {
    const key1 = provider.getKey();
    expect(key1.length).toBe(32);
    expect(existsSync(keyFilePath)).toBe(true);

    // Second call should return same key
    provider.clearCache();
    const key2 = provider.getKey();
    expect(key2).toEqual(key1);
  });

  it('should cache key across multiple calls', () => {
    const key1 = provider.getKey();
    const key2 = provider.getKey();
    expect(key1).toBe(key2); // Same reference
  });
});