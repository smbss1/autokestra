// CLI commands for secret management (server API client)

import { createInterface } from 'readline';
import { ApiClientConfig, ApiError, requestJson } from '../apiClient';

export interface CliConfig {
  api: ApiClientConfig;
}

export interface SecretsListOptions {
  json?: boolean;
}

export interface SecretsSetOptions {
  json?: boolean;
}

export interface SecretsDeleteOptions {
  force?: boolean;
  json?: boolean;
}

export interface SecretsGetOptions {
  json?: boolean;
}

type SecretListItemDto = {
  name: string;
  createdAt: string;
  updatedAt: string;
};

export async function setSecret(
  config: CliConfig,
  name: string,
  value?: string,
  options: SecretsSetOptions = {},
): Promise<void> {
  let secretValue = value;

  if (!secretValue) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    secretValue = await new Promise<string>((resolve) => {
      rl.question(`Enter value for secret '${name}': `, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  if (!secretValue || !secretValue.trim()) {
    throw new Error('Secret value cannot be empty');
  }

  await requestJson<void>(config.api, 'PUT', `/api/v1/secrets/${encodeURIComponent(name)}`, {
    body: { value: secretValue },
  });

  if (options.json) {
    console.log(JSON.stringify({ set: true, name }, null, 2));
  } else {
    console.log(`Set secret '${name}'`);
  }
}

export async function getSecret(config: CliConfig, name: string, options: SecretsGetOptions = {}): Promise<string> {
  try {
    const result = await requestJson<{ name: string; value: string }>(
      config.api,
      'GET',
      `/api/v1/secrets/${encodeURIComponent(name)}`,
    );

    if (options.json) {
      console.log(JSON.stringify({ secret: { name: result.name, value: result.value } }, null, 2));
    } else {
      console.log(result.value);
    }

    return result.value;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error(`Secret '${name}' not found`);
    }
    throw error;
  }
}

export async function listSecrets(config: CliConfig, options: SecretsListOptions = {}): Promise<SecretListItemDto[]> {
  const result = await requestJson<{ secrets: SecretListItemDto[]; total: number }>(config.api, 'GET', '/api/v1/secrets');

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.secrets;
  }

  if (!result.secrets || result.secrets.length === 0) {
    console.log('No secrets found');
    return [];
  }

  for (const s of result.secrets) {
    console.log(`${s.name}\tupdated ${s.updatedAt}`);
  }

  return result.secrets;
}

export async function deleteSecret(config: CliConfig, name: string, options: SecretsDeleteOptions = {}): Promise<void> {
  if (!options.force) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
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

  try {
    await requestJson<void>(config.api, 'DELETE', `/api/v1/secrets/${encodeURIComponent(name)}`);
    if (options.json) {
      console.log(JSON.stringify({ deleted: true, name }, null, 2));
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error(`Secret '${name}' not found`);
    }
    throw error;
  }
}