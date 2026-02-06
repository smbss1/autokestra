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