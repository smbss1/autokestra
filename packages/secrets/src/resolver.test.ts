import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { SecretStore } from './store.js';
import { SecretResolver } from './resolver.js';

describe('SecretResolver', () => {
  let store: SecretStore;
  let resolver: SecretResolver;
  const testDbPath = join(process.cwd(), 'test-resolver.db');

  beforeEach(async () => {
    try {
      unlinkSync(testDbPath);
    } catch {}
    store = new SecretStore(testDbPath);
    resolver = new SecretResolver(store);

    await store.set('API_KEY', 'secret-api-key');
    await store.set('DB_PASS', 'secret-password');
  });

  afterEach(() => {
    store.close();
    try {
      unlinkSync(testDbPath);
    } catch {}
  });

  it('should resolve simple secret template', async () => {
    const input = 'https://api.example.com?key={{ secrets.API_KEY }}';
    const output = await resolver.resolve(input, ['API_KEY']);
    expect(output).toBe('https://api.example.com?key=secret-api-key');
  });

  it('should resolve multiple secrets in same string', async () => {
    const input = 'user:pass@host?key={{ secrets.API_KEY }}&pass={{ secrets.DB_PASS }}';
    const output = await resolver.resolve(input, ['API_KEY', 'DB_PASS']);
    expect(output).toBe('user:pass@host?key=secret-api-key&pass=secret-password');
  });

  it('should resolve secrets in nested objects', async () => {
    const input = {
      database: {
        url: 'postgres://user:{{ secrets.DB_PASS }}@host/db',
        options: {
          ssl: true,
          apiKey: '{{ secrets.API_KEY }}'
        }
      }
    };
    const output = await resolver.resolve(input, ['API_KEY', 'DB_PASS']);
    expect(output.database.url).toBe('postgres://user:secret-password@host/db');
    expect(output.database.options.apiKey).toBe('secret-api-key');
  });

  it('should resolve secrets in arrays', async () => {
    const input = [
      'first-{{ secrets.API_KEY }}',
      { key: '{{ secrets.DB_PASS }}' }
    ];
    const output = await resolver.resolve(input, ['API_KEY', 'DB_PASS']);
    expect(output[0]).toBe('first-secret-api-key');
    expect(output[1].key).toBe('secret-password');
  });

  it('should throw error for undeclared secret', async () => {
    const input = '{{ secrets.UNDECLARED }}';
    await expect(resolver.resolve(input, ['API_KEY'])).rejects.toThrow("Secret 'UNDECLARED' is not declared");
  });

  it('should throw error for missing secret', async () => {
    const input = '{{ secrets.MISSING }}';
    await expect(resolver.resolve(input, ['MISSING'])).rejects.toThrow("Secret 'MISSING' not found");
  });

  it('should fallback to environment variable', async () => {
    const originalEnv = process.env.FALLBACK_SECRET;
    process.env.FALLBACK_SECRET = 'env-value';

    try {
      const input = '{{ secrets.FALLBACK_SECRET }}';
      const output = await resolver.resolve(input, ['FALLBACK_SECRET']);
      expect(output).toBe('env-value');
    } finally {
      process.env.FALLBACK_SECRET = originalEnv;
    }
  });

  it('should cache resolved secrets', async () => {
    const input1 = '{{ secrets.API_KEY }}';
    const input2 = '{{ secrets.API_KEY }} again';
    await resolver.resolve(input1, ['API_KEY']);
    await resolver.resolve(input2, ['API_KEY']);
    // Should not call store.get twice
    expect(resolver.getResolvedSecrets()).toEqual(['secret-api-key']);
  });
});