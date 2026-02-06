import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { Config, DEFAULT_CONFIG } from './config.js';

export class ConfigLoadError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function validateConfig(config: Config): void {
  const errors: string[] = [];

  // Server validation
  if (typeof config.server.port !== 'number' || config.server.port < 1 || config.server.port > 65535) {
    errors.push('server.port must be a number between 1 and 65535');
  }

  // Storage validation
  if (!['sqlite', 'postgresql'].includes(config.storage.type)) {
    errors.push('storage.type must be either "sqlite" or "postgresql"');
  }

  if (config.storage.type === 'sqlite' && !config.storage.path) {
    errors.push('storage.path is required for sqlite storage');
  }

  if (config.storage.type === 'postgresql') {
    if (!config.storage.host) errors.push('storage.host is required for postgresql storage');
    if (!config.storage.database) errors.push('storage.database is required for postgresql storage');
  }

  // Execution validation
  if (typeof config.execution.maxConcurrentWorkflows !== 'number' || config.execution.maxConcurrentWorkflows < 1) {
    errors.push('execution.maxConcurrentWorkflows must be a positive number');
  }

  if (typeof config.execution.maxConcurrentTasks !== 'number' || config.execution.maxConcurrentTasks < 1) {
    errors.push('execution.maxConcurrentTasks must be a positive number');
  }

  if (config.execution.defaultTimeoutSeconds !== undefined &&
      (typeof config.execution.defaultTimeoutSeconds !== 'number' || config.execution.defaultTimeoutSeconds < 1)) {
    errors.push('execution.defaultTimeoutSeconds must be a positive number if specified');
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

function applyEnvOverrides(config: Config): Config {
  const envOverrides: Partial<Config> = {};

  // Server overrides
  if (process.env.WORKFLOW_SERVER_PORT) {
    envOverrides.server = { ...config.server, port: parseInt(process.env.WORKFLOW_SERVER_PORT, 10) };
  }

  // Storage overrides
  if (process.env.WORKFLOW_STORAGE_TYPE) {
    envOverrides.storage = { ...config.storage, type: process.env.WORKFLOW_STORAGE_TYPE as 'sqlite' | 'postgresql' };
  }
  if (process.env.WORKFLOW_STORAGE_PATH) {
    envOverrides.storage = { ...config.storage, ...envOverrides.storage, path: process.env.WORKFLOW_STORAGE_PATH };
  }
  if (process.env.WORKFLOW_STORAGE_HOST) {
    envOverrides.storage = { ...config.storage, ...envOverrides.storage, host: process.env.WORKFLOW_STORAGE_HOST };
  }
  if (process.env.WORKFLOW_STORAGE_PORT) {
    envOverrides.storage = { ...config.storage, ...envOverrides.storage, port: parseInt(process.env.WORKFLOW_STORAGE_PORT, 10) };
  }
  if (process.env.WORKFLOW_STORAGE_DATABASE) {
    envOverrides.storage = { ...config.storage, ...envOverrides.storage, database: process.env.WORKFLOW_STORAGE_DATABASE };
  }
  if (process.env.WORKFLOW_STORAGE_USERNAME) {
    envOverrides.storage = { ...config.storage, ...envOverrides.storage, username: process.env.WORKFLOW_STORAGE_USERNAME };
  }
  if (process.env.WORKFLOW_STORAGE_PASSWORD) {
    envOverrides.storage = { ...config.storage, ...envOverrides.storage, password: process.env.WORKFLOW_STORAGE_PASSWORD };
  }

  // Execution overrides
  if (process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS) {
    envOverrides.execution = { ...config.execution, ...envOverrides.execution, maxConcurrentWorkflows: parseInt(process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS, 10) };
  }
  if (process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS) {
    envOverrides.execution = { ...config.execution, ...envOverrides.execution, maxConcurrentTasks: parseInt(process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS, 10) };
  }
  if (process.env.WORKFLOW_EXECUTION_DEFAULT_TIMEOUT_SECONDS) {
    envOverrides.execution = { ...config.execution, ...envOverrides.execution, defaultTimeoutSeconds: parseInt(process.env.WORKFLOW_EXECUTION_DEFAULT_TIMEOUT_SECONDS, 10) };
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