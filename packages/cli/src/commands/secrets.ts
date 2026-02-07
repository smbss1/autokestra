// CLI commands for secret management

import { SecretStore } from '@autokestra/secrets';
import { createInterface } from 'readline';

export interface SecretsListOptions {
  json?: boolean;
}

export interface SecretsDeleteOptions {
  force?: boolean;
}

/**
 * Set a secret value
 */
export async function setSecret(name: string, value?: string): Promise<void> {
  const store = new SecretStore();

  try {
    let secretValue = value;

    if (!secretValue) {
      // Prompt for value
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      secretValue = await new Promise<string>((resolve) => {
        rl.question(`Enter value for secret '${name}': `, (answer) => {
          rl.close();
          resolve(answer);
        });
      });
    }

    if (!secretValue) {
      throw new Error('Secret value cannot be empty');
    }

    await store.set(name, secretValue);
  } catch (error) {
    throw error;
  } finally {
    store.close();
  }
}

/**
 * Get a secret value
 */
export async function getSecret(name: string): Promise<string> {
  const store = new SecretStore();

  try {
    const value = await store.get(name);
    if (value === null) {
      throw new Error(`Secret '${name}' not found`);
    }

    return value;
  } catch (error) {
    throw error;
  } finally {
    store.close();
  }
}

/**
 * List secrets
 */
export async function listSecrets(options: SecretsListOptions = {}): Promise<ReturnType<SecretStore['list']>> {
  const store = new SecretStore();

  try {
    const secrets = store.list();

    // When used as a library (tests / future commands), return data.
    // CLI layer can format/print as needed.
    void options;
    return secrets;
  } catch (error) {
    throw error;
  } finally {
    store.close();
  }
}

/**
 * Delete a secret
 */
export async function deleteSecret(name: string, options: SecretsDeleteOptions = {}): Promise<void> {
  const store = new SecretStore();

  try {
    if (!options.force) {
      // Confirm deletion
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const confirmed = await new Promise<boolean>((resolve) => {
        rl.question(`Delete secret '${name}'? (y/N): `, (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirmed) {
        console.log('Deletion cancelled');
        return;
      }
    }

    const deleted = store.delete(name);
    if (deleted) {
      return;
    } else {
      throw new Error(`Secret '${name}' not found`);
    }
  } catch (error) {
    throw error;
  } finally {
    store.close();
  }
}