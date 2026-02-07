import { pbkdf2Sync, randomBytes } from 'node:crypto';

export class SecretEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256; // 256 bits
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly PBKDF2_SALT = Buffer.from('autokestra-secrets-salt'); // Fixed salt for consistency

  /**
   * Derive encryption key from master key/password
   */
  static deriveKey(masterKey: string): Buffer {
    return pbkdf2Sync(
      masterKey,
      this.PBKDF2_SALT,
      this.PBKDF2_ITERATIONS,
      this.KEY_LENGTH / 8, // Convert bits to bytes
      'sha256'
    );
  }

  /**
   * Encrypt a secret value using Web Crypto API
   */
  static async encrypt(value: string, key: Buffer): Promise<{
    encrypted: Buffer;
    iv: Buffer;
    authTag: Buffer;
  }> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: this.ALGORITHM },
      false,
      ['encrypt']
    );

    const iv = randomBytes(this.IV_LENGTH);
    const encodedValue = new TextEncoder().encode(value);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      cryptoKey,
      encodedValue
    );

    // For GCM, the auth tag is included at the end of the ciphertext
    const encryptedArray = new Uint8Array(encrypted);
    const authTagLength = 16; // 128 bits
    const ciphertext = encryptedArray.slice(0, encryptedArray.length - authTagLength);
    const authTag = encryptedArray.slice(encryptedArray.length - authTagLength);

    return {
      encrypted: Buffer.from(ciphertext),
      iv: Buffer.from(iv),
      authTag: Buffer.from(authTag),
    };
  }

  /**
   * Decrypt a secret value using Web Crypto API
   */
  static async decrypt(encrypted: Buffer, iv: Buffer, authTag: Buffer, key: Buffer): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: this.ALGORITHM },
      false,
      ['decrypt']
    );

    // Reconstruct the encrypted data with auth tag
    const encryptedWithTag = new Uint8Array(encrypted.length + authTag.length);
    encryptedWithTag.set(encrypted);
    encryptedWithTag.set(authTag, encrypted.length);

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        cryptoKey,
        encryptedWithTag
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error('Decryption failed: ' + error);
    }
  }
}