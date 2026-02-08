import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SecretStore } from './store';

export async function createTempSecretStore(initial?: Record<string, string>): Promise<{
  store: SecretStore;
  dbPath: string;
  cleanup: () => void;
}> {
  const dir = mkdtempSync(join(tmpdir(), 'autokestra-secrets-'));
  const dbPath = join(dir, 'secrets.db');

  const store = new SecretStore(dbPath);

  if (initial) {
    for (const [name, value] of Object.entries(initial)) {
      await store.set(name, value);
    }
  }

  const cleanup = () => {
    try {
      store.close();
    } catch {
      // ignore
    }
    rmSync(dir, { recursive: true, force: true });
  };

  return { store, dbPath, cleanup };
}
