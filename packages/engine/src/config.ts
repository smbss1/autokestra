import { object, number, string, union, literal, optional, check, pipe, minValue, maxValue } from 'valibot';

export interface ServerConfig {
  port: number;
  host?: string;
}

export interface StorageConfig {
  type: 'sqlite' | 'postgresql';
  path?: string; // for sqlite
  host?: string; // for postgresql
  port?: number; // for postgresql
  database?: string; // for postgresql
  username?: string; // for postgresql
  password?: string; // for postgresql
}

export interface ExecutionConfig {
  maxConcurrentWorkflows: number;
  maxConcurrentTasks: number;
  defaultTimeoutSeconds?: number;
}

export interface Config {
  server: ServerConfig;
  storage: StorageConfig;
  execution: ExecutionConfig;
}

export const DEFAULT_CONFIG: Config = {
  server: {
    port: 7233,
    host: '0.0.0.0',
  },
  storage: {
    type: 'sqlite',
    path: './data/db.sqlite',
  },
  execution: {
    maxConcurrentWorkflows: 10,
    maxConcurrentTasks: 50,
    defaultTimeoutSeconds: 3600,
  },
};

// Valibot schemas
export const serverConfigSchema = object({
  port: pipe(number(), minValue(1), maxValue(65535)),
  host: optional(string()),
});

export const storageConfigSchema = object({
  type: union([literal('sqlite'), literal('postgresql')]),
  path: optional(string()),
  host: optional(string()),
  port: optional(pipe(number(), minValue(1), maxValue(65535))),
  database: optional(string()),
  username: optional(string()),
  password: optional(string()),
});

export const executionConfigSchema = object({
  maxConcurrentWorkflows: pipe(number(), minValue(1)),
  maxConcurrentTasks: pipe(number(), minValue(1)),
  defaultTimeoutSeconds: optional(pipe(number(), minValue(1))),
});

export const configSchema = object({
  server: serverConfigSchema,
  storage: storageConfigSchema,
  execution: executionConfigSchema,
});