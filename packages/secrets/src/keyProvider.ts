import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export class MasterKeyProvider {
  private static readonly DEFAULT_KEY_FILE_PATH = join(homedir(), '.autokestra', 'secret.key');
  private static readonly KEY_LENGTH = 32; // 256 bits

  private cachedKey: Buffer | null = null;
  private readonly keyFilePath: string;

  constructor(keyFilePath?: string) {
    this.keyFilePath = keyFilePath || MasterKeyProvider.DEFAULT_KEY_FILE_PATH;
  }

  /**
   * Get the master key, checking in order: env var, key file, generate new
   */
  getKey(): Buffer {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    // 1. Check environment variable
    const envKey = process.env.AUTOKESTRA_SECRET_KEY;
    if (envKey) {
      this.cachedKey = Buffer.from(envKey, 'hex');
      if (this.cachedKey.length !== MasterKeyProvider.KEY_LENGTH) {
        throw new Error(`AUTOKESTRA_SECRET_KEY must be ${MasterKeyProvider.KEY_LENGTH * 2} hex characters`);
      }
      return this.cachedKey;
    }

    // 2. Check key file
    if (existsSync(this.keyFilePath)) {
      const fileKey = readFileSync(this.keyFilePath);
      if (fileKey.length !== MasterKeyProvider.KEY_LENGTH) {
        throw new Error(`Invalid key file at ${this.keyFilePath}`);
      }
      this.cachedKey = fileKey;
      return this.cachedKey;
    }

    // 3. Generate new key and save to file
    this.cachedKey = randomBytes(MasterKeyProvider.KEY_LENGTH);
    this.saveKeyToFile(this.cachedKey);
    return this.cachedKey;
  }

  /**
   * Save key to file (creates directory if needed)
   */
  private saveKeyToFile(key: Buffer): void {
    const dir = join(homedir(), '.autokestra');
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(this.keyFilePath, key);
    } catch (error) {
      throw new Error(`Failed to save key file to ${this.keyFilePath}: ${error}`);
    }
  }

  /**
   * Clear cached key (for testing)
   */
  clearCache(): void {
    this.cachedKey = null;
  }
}