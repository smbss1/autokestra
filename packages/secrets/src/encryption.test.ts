import { describe, it, expect } from 'bun:test';
import { SecretEncryption } from './encryption.js';

describe('SecretEncryption', () => {
  const testKey = SecretEncryption.deriveKey('test-master-key');
  const testValue = 'my-secret-api-key';

  it('should encrypt and decrypt round-trip', async () => {
    const { encrypted, iv, authTag } = await SecretEncryption.encrypt(testValue, testKey);
    const decrypted = await SecretEncryption.decrypt(encrypted, iv, authTag, testKey);
    expect(decrypted).toBe(testValue);
  });

  it('should generate unique IVs for each encryption', async () => {
    const { iv: iv1 } = await SecretEncryption.encrypt(testValue, testKey);
    const { iv: iv2 } = await SecretEncryption.encrypt(testValue, testKey);
    expect(iv1).not.toEqual(iv2);
  });

  it('should fail decryption with wrong key', async () => {
    const wrongKey = SecretEncryption.deriveKey('wrong-key');
    const { encrypted, iv, authTag } = await SecretEncryption.encrypt(testValue, testKey);
    await expect(SecretEncryption.decrypt(encrypted, iv, authTag, wrongKey)).rejects.toThrow();
  });

  it('should fail decryption with tampered data', async () => {
    const { encrypted, iv, authTag } = await SecretEncryption.encrypt(testValue, testKey);
    const tampered = Buffer.from(encrypted);
    tampered[0] = tampered[0] ^ 0xFF; // Flip a bit
    await expect(SecretEncryption.decrypt(tampered, iv, authTag, testKey)).rejects.toThrow();
  });
});