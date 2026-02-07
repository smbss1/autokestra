import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadConfigFromFile, ConfigLoadError, ConfigValidationError } from './configLoader.js';
import { SqliteStorageConfig } from './config.js';

describe('ConfigLoader', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = join(tmpdir(), `config-${Date.now()}.yaml`);
  });

  afterEach(() => {
    try {
      unlinkSync(tempFile);
    } catch {
      // ignore
    }
  });

  describe('YAML parsing', () => {
    it('should load valid YAML config', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: sqlite
  path: ./test.db
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      const config = loadConfigFromFile(tempFile);

      expect(config.server.port).toBe(8080);
      expect(config.storage.type).toBe('sqlite');
      expect((config.storage as SqliteStorageConfig).path).toBe('./test.db');
      expect(config.execution.maxConcurrentWorkflows).toBe(5);
      expect(config.execution.maxConcurrentTasks).toBe(10);
    });

    it('should throw ConfigLoadError for invalid YAML', () => {
      writeFileSync(tempFile, 'invalid: yaml: content: [');

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigLoadError);
    });

    it('should throw ConfigLoadError for missing required sections', () => {
      const configYaml = `
server:
  port: 8080
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigLoadError);
    });
  });

  describe('Environment overrides', () => {
    it('should override YAML with environment variables', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: sqlite
  path: ./test.db
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      process.env.WORKFLOW_SERVER_PORT = '9090';
      process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS = '10';

      try {
        const config = loadConfigFromFile(tempFile);

        expect(config.server.port).toBe(9090);
        expect(config.execution.maxConcurrentWorkflows).toBe(10);
      } finally {
        delete process.env.WORKFLOW_SERVER_PORT;
        delete process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS;
      }
    });

    it('should handle numeric environment variables', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: sqlite
  path: ./test.db
execution:
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      process.env.WORKFLOW_SERVER_PORT = '9090';
      process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS = '20';

      try {
        const config = loadConfigFromFile(tempFile);

        expect(config.server.port).toBe(9090);
        expect(config.execution.maxConcurrentTasks).toBe(20);
      } finally {
        delete process.env.WORKFLOW_SERVER_PORT;
        delete process.env.WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS;
      }
    });
  });

  describe('Validation', () => {
    it('should throw ConfigValidationError for invalid port', () => {
      const configYaml = `
server:
  port: 99999
storage:
  type: sqlite
  path: ./test.db
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError for invalid storage type', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: invalid
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError for negative concurrency', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: sqlite
  path: ./test.db
execution:
  maxConcurrentWorkflows: -1
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError for postgresql without host', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: postgresql
  database: testdb
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError for postgresql without database', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: postgresql
  host: localhost
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError for negative retention days', () => {
      const configYaml = `
server:
  port: 8080
storage:
  type: sqlite
  path: ./test.db
  retentionDays: -1
execution:
  maxConcurrentWorkflows: 5
  maxConcurrentTasks: 10
`;
      writeFileSync(tempFile, configYaml);

      expect(() => loadConfigFromFile(tempFile)).toThrow(ConfigValidationError);
    });
  });
});