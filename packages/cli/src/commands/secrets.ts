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
      console.error('Secret value cannot be empty');
      process.exit(1);
    }

    store.set(name, secretValue);
    console.log(`Secret '${name}' set successfully`);
  } catch (error) {
    console.error('Error setting secret:', error);
    process.exit(1);
  } finally {
    store.close();
  }
}

/**
 * Get a secret value
 */
export async function getSecret(name: string): Promise<void> {
  const store = new SecretStore();

  try {
    const value = store.get(name);
    if (value === null) {
      console.error(`Secret '${name}' not found`);
      process.exit(1);
    }

    console.warn('WARNING: Displaying secret values can be a security risk!');
    console.log(value);
  } catch (error) {
    console.error('Error getting secret:', error);
    process.exit(1);
  } finally {
    store.close();
  }
}

/**
 * List secrets
 */
export async function listSecrets(options: SecretsListOptions = {}): Promise<void> {
  const store = new SecretStore();

  try {
    const secrets = store.list();

    if (options.json) {
      console.log(JSON.stringify({ secrets }, null, 2));
    } else {
      if (secrets.length === 0) {
        console.log('No secrets found');
      } else {
        console.log('Secrets:');
        secrets.forEach(secret => {
          console.log(`  ${secret.name} (created: ${new Date(secret.created_at).toISOString()})`);
        });
      }
    }
  } catch (error) {
    console.error('Error listing secrets:', error);
    process.exit(1);
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
      console.log(`Secret '${name}' deleted successfully`);
    } else {
      console.error(`Secret '${name}' not found`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error deleting secret:', error);
    process.exit(1);
  } finally {
    store.close();
  }
}