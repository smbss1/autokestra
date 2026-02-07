import { object, number, string, union, literal, optional, pipe, minValue, maxValue, array } from 'valibot';

export interface ServerConfig {
  port: number;
  host?: string;
  apiKeys?: string[];
}

export interface SqliteStorageConfig {
  type: 'sqlite';
  path: string;
  retentionDays?: number;
}

export interface PostgresqlStorageConfig {
  type: 'postgresql';
  host: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  retentionDays?: number;
}

export type StorageConfig = SqliteStorageConfig | PostgresqlStorageConfig;

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
    retentionDays: 30,
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
  apiKeys: optional(array(string())),
});

export const sqliteStorageSchema = object({
  type: literal('sqlite'),
  path: string(),
  retentionDays: optional(pipe(number(), minValue(1))),
});

export const postgresqlStorageSchema = object({
  type: literal('postgresql'),
  host: string(),
  port: optional(pipe(number(), minValue(1), maxValue(65535))),
  database: string(),
  username: optional(string()),
  password: optional(string()),
  retentionDays: optional(pipe(number(), minValue(1))),
});

export const storageConfigSchema = union([sqliteStorageSchema, postgresqlStorageSchema]);

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

// Schemas for environment variable validation
export const envServerOverrideSchema = object({
  port: optional(pipe(number(), minValue(1), maxValue(65535))),
  host: optional(string()),
});

export const envStorageOverrideSchema = object({
  type: optional(union([literal('sqlite'), literal('postgresql')])),
  path: optional(string()),
  host: optional(string()),
  port: optional(pipe(number(), minValue(1), maxValue(65535))),
  database: optional(string()),
  username: optional(string()),
  password: optional(string()),
  retentionDays: optional(pipe(number(), minValue(1))),
});

export const envExecutionOverrideSchema = object({
  maxConcurrentWorkflows: optional(pipe(number(), minValue(1))),
  maxConcurrentTasks: optional(pipe(number(), minValue(1))),
  defaultTimeoutSeconds: optional(pipe(number(), minValue(1))),
});