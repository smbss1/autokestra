import { Database } from 'bun:sqlite';
import { join } from 'path';
import { MasterKeyProvider } from './keyProvider.js';
import { SecretEncryption } from './encryption.js';

export interface SecretMetadata {
  name: string;
  created_at: number;
  updated_at: number;
}

export class SecretStore {
  private db: Database;
  private keyProvider: MasterKeyProvider;

  constructor(dbPath?: string) {
    const defaultPath = join(process.cwd(), 'secrets.db');
    const envPath = process.env.SECRETS_DB_PATH;
    this.db = new Database(dbPath || envPath || defaultPath);
    this.keyProvider = new MasterKeyProvider();
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS secrets (
        name TEXT PRIMARY KEY,
        encrypted_value BLOB NOT NULL,
        iv BLOB NOT NULL,
        auth_tag BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  async set(name: string, value: string): Promise<void> {
    if (!this.isValidSecretName(name)) {
      throw new Error(`Invalid secret name '${name}'. Names must contain only alphanumeric characters, underscores, and hyphens.`);
    }

    const key = this.keyProvider.getKey();
    const { encrypted, iv, authTag } = await SecretEncryption.encrypt(value, key);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO secrets (name, encrypted_value, iv, auth_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(name, encrypted, iv, authTag, now, now);
  }

  async get(name: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT encrypted_value, iv, auth_tag FROM secrets WHERE name = ?
    `);

    const row = stmt.get(name) as { encrypted_value: Buffer; iv: Buffer; auth_tag: Buffer } | undefined;
    if (!row) {
      return null;
    }

    const key = this.keyProvider.getKey();
    return await SecretEncryption.decrypt(row.encrypted_value, row.iv, row.auth_tag, key);
  }

  list(): SecretMetadata[] {
    const stmt = this.db.prepare(`
      SELECT name, created_at, updated_at FROM secrets ORDER BY name
    `);

    return stmt.all() as SecretMetadata[];
  }

  delete(name: string): boolean {
    const stmt = this.db.prepare('DELETE FROM secrets WHERE name = ?');
    const result = stmt.run(name);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }

  private isValidSecretName(name: string): boolean {
    // Allow human-friendly names while keeping them shell/env-safe-ish.
    // Examples: API_KEY, api-key, mySecret_1
    return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name);
  }
}