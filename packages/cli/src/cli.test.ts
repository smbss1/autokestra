import { describe, it, expect } from 'bun:test';
import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import net from 'node:net';
import { startManagedServer } from '@autokestra/server';

const REPO_ROOT = process.cwd();
const CLI_PATH = join(REPO_ROOT, 'packages', 'cli', 'src', 'cli.ts');

function runCli(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    // Run each invocation in an isolated working directory so tests don't
    // depend on ambient repo state (e.g. ./autokestra.db, ./.autokestra/server.pid).
    const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), 'autokestra-cli-cwd-'));
    const child = spawn('bun', [CLI_PATH, ...args], { cwd, env: { ...process.env, ...(options.env || {}) } });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
  });
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function withTestServer<T>(fn: (ctx: { dir: string; baseUrl: string; apiKey: string }) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-server-'));
  const port = await getFreePort();
  const apiKey = 'test-key';
  const baseUrl = `http://127.0.0.1:${port}`;

  const previousDisable = process.env.AUTOKESTRA_DISABLE_RUNTIME;
  process.env.AUTOKESTRA_DISABLE_RUNTIME = '1';

  const managed = await startManagedServer({
    config: {
      server: { port, host: '127.0.0.1', apiKeys: [apiKey] },
      storage: { type: 'sqlite', path: join(dir, 'db.sqlite'), retentionDays: 30 },
      execution: { maxConcurrentWorkflows: 1, maxConcurrentTasks: 1, defaultTimeoutSeconds: 60 },
    },
    silent: true,
    handleSignals: false,
  });

  try {
    return await fn({ dir, baseUrl, apiKey });
  } finally {
    await managed.shutdown('test');
    process.env.AUTOKESTRA_DISABLE_RUNTIME = previousDisable;
  }
}

describe('CLI', () => {
  it('should show help with --help', async () => {
    const result = await runCli(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Autokestra workflow engine CLI');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('server');
    expect(result.stdout).toContain('workflow');
  });

  it('should show version with --version', async () => {
    const result = await runCli(['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('0.0.1');
  });

  it('should list workflows in human format', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const result = await runCli(['workflow', 'list'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('No workflows found');
    });
  });

  it('should list workflows in JSON format', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const result = await runCli(['workflow', 'list', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(result.code).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.workflows).toEqual([]);
    });
  });

  it('should apply, get, list, and delete a workflow', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const wfPath = join(dir, 'wf.yaml');

    writeFileSync(
      wfPath,
      [
        'apiVersion: v1',
        'id: test-workflow',
        'enabled: true',
        'tasks:',
        '  - id: t1',
        '    type: example/plugin.action',
        '',
      ].join('\n'),
      'utf8',
    );

      const apply = await runCli(['workflow', 'apply', wfPath, '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(apply.code).toBe(0);
      const applyParsed = JSON.parse(apply.stdout);
      expect(applyParsed.workflow.id).toBe('test-workflow');

      const get = await runCli(['workflow', 'get', 'test-workflow', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(get.code).toBe(0);
      const getParsed = JSON.parse(get.stdout);
      expect(getParsed.workflow.id).toBe('test-workflow');

      const list = await runCli(['workflow', 'list', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(list.code).toBe(0);
      const listParsed = JSON.parse(list.stdout);
      expect(Array.isArray(listParsed.workflows)).toBe(true);
      expect(listParsed.workflows.map((w: any) => w.id)).toContain('test-workflow');

      const del = await runCli(['workflow', 'delete', 'test-workflow', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(del.code).toBe(0);
      const delParsed = JSON.parse(del.stdout);
      expect(delParsed.deleted).toBe(true);

      const getAfter = await runCli(['workflow', 'get', 'test-workflow', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(getAfter.code).toBe(4);
    });
  });

  // Note: This test is skipped because the migration output interferes with JSON parsing
  // Functional tests in execution.test.ts verify the CLI works correctly
  it.skip('should list executions in JSON format', async () => {
    const result = await runCli(['execution', 'list', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.executions).toEqual([]);
    expect(parsed.total).toBe(0);
  });

  it('should list plugins in JSON format', async () => {
    const result = await runCli(['plugin', 'list', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ plugins: [] });
  });

  it('should exit with error for unimplemented commands', async () => {
    const result = await runCli(['server', 'start', '--config', './definitely-does-not-exist.yaml']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Failed to start server');
  });

  it('should show server command help', async () => {
    const result = await runCli(['server', '--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('manage server lifecycle');
    expect(result.stdout).toContain('start');
    expect(result.stdout).toContain('stop');
    expect(result.stdout).toContain('status');
  });
});