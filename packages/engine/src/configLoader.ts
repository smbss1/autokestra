import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { safeParse } from 'valibot';
import { Config, DEFAULT_CONFIG, configSchema, envServerOverrideSchema, envStorageOverrideSchema, envExecutionOverrideSchema } from './config.js';

export class ConfigLoadError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string, public readonly issues?: any[]) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function validateConfig(config: Config): void {
  const result = safeParse(configSchema, config);
  if (!result.success) {
    const issues = result.issues.map(issue => `${issue.path?.map(p => p.key).join('.')}: ${issue.message}`).join('\n');
    throw new ConfigValidationError(`Configuration validation failed:\n${issues}`, result.issues);
  }
}

function applyEnvOverrides(config: Config): Config {
  const envOverrides: Partial<Config> = {};

  // Server overrides
  const serverOverrides: any = {};
  if (process.env.WORKFLOW_SERVER_PORT) {
    serverOverrides.port = parseInt(process.env.WORKFLOW_SERVER_PORT, 10);
  }
  if (process.env.WORKFLOW_SERVER_HOST) {
    serverOverrides.host = process.env.WORKFLOW_SERVER_HOST;
  }
  if (Object.keys(serverOverrides).length > 0) {
    const result = safeParse(envServerOverrideSchema, serverOverrides);
    if (!result.success) {
      throw new ConfigValidationError(`Invalid server environment overrides: ${result.issues.map(i => i.message).join(', ')}`);
    }
    envOverrides.server = { ...config.server, ...serverOverrides };
  }

  // Storage overrides
  const storageOverrides: any = {};
  if (process.env.WORKFLOW_STORAGE_TYPE) {
    storageOverrides.type = process.env.WORKFLOW_STORAGE_TYPE;
  }
  if (process.env.WORKFLOW_STORAGE_PATH) {
    storageOverrides.path = process.env.WORKFLOW_STORAGE_PATH;
  }
  if (process.env.WORKFLOW_STORAGE_HOST) {
    storageOverrides.host = process.env.WORKFLOW_STORAGE_HOST;
  }
  if (process.env.WORKFLOW_STORAGE_PORT) {
    storageOverrides.port = parseInt(process.env.WORKFLOW_STORAGE_PORT, 10);
  }
  if (process.env.WORKFLOW_STORAGE_DATABASE) {
    storageOverrides.database = process.env.WORKFLOW_STORAGE_DATABASE;
  }
  if (process.env.WORKFLOW_STORAGE_USERNAME) {
    storageOverrides.username = process.env.WORKFLOW_STORAGE_USERNAME;
  }
  if (process.env.WORKFLOW_STORAGE_PASSWORD) {
    storageOverrides.password = process.env.WORKFLOW_STORAGE_PASSWORD;
  }
  if (Object.keys(storageOverrides).length > 0) {
    const result = safeParse(envStorageOverrideSchema, storageOverrides);
    if (!result.success) {
      throw new ConfigValidationError(`Invalid storage environment overrides: ${result.issues.map(i => i.message).join(', ')}`);
    }
    envOverrides.storage = { ...config.storage, ...storageOverrides };
  }

  // Execution overrides
  const executionOverrides: any = {};
  if (process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS) {
    executionOverrides.maxConcurrentWorkflows = parseInt(process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS, 10);
  }
  if (process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS) {
    executionOverrides.maxConcurrentTasks = parseInt(process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS, 10);
  }
  if (process.env.WORKFLOW_EXECUTION_DEFAULT_TIMEOUT_SECONDS) {
    executionOverrides.defaultTimeoutSeconds = parseInt(process.env.WORKFLOW_EXECUTION_DEFAULT_TIMEOUT_SECONDS, 10);
  }
  if (Object.keys(executionOverrides).length > 0) {
    const result = safeParse(envExecutionOverrideSchema, executionOverrides);
    if (!result.success) {
      throw new ConfigValidationError(`Invalid execution environment overrides: ${result.issues.map(i => i.message).join(', ')}`);
    }
    envOverrides.execution = { ...config.execution, ...executionOverrides };
  }

  // Deep merge: env overrides take precedence
  return {
    server: { ...config.server, ...envOverrides.server },
    storage: { ...config.storage, ...envOverrides.storage },
    execution: { ...config.execution, ...envOverrides.execution },
  };
}

export function loadConfigFromFile(filePath: string): Config {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const parsed = parse(fileContent);

    if (!parsed || typeof parsed !== 'object') {
      throw new ConfigLoadError(`Invalid YAML structure in ${filePath}`);
    }

    // Basic validation - could be enhanced with a schema validator
    if (!parsed.server || !parsed.storage || !parsed.execution) {
      throw new ConfigLoadError(`Missing required config sections in ${filePath}`);
    }

    const baseConfig: Config = {
      server: { ...DEFAULT_CONFIG.server, ...parsed.server },
      storage: { ...DEFAULT_CONFIG.storage, ...parsed.storage },
      execution: { ...DEFAULT_CONFIG.execution, ...parsed.execution },
    };
    const finalConfig = applyEnvOverrides(baseConfig);
    validateConfig(finalConfig);
    return finalConfig;
  } catch (error) {
    if (error instanceof ConfigLoadError || error instanceof ConfigValidationError) {
      throw error;
    }
    throw new ConfigLoadError(`Failed to load config from ${filePath}`, error as Error);
  }
}