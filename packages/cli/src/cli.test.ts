import { describe, it, expect } from 'bun:test';
import { spawn, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
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
  const previousPluginPaths = process.env.AUTOKESTRA_PLUGIN_PATHS;
  process.env.AUTOKESTRA_PLUGIN_PATHS = join(dir, 'plugins');
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
    process.env.AUTOKESTRA_PLUGIN_PATHS = previousPluginPaths;
  }
}

function createPluginArchive(params: {
  dir: string;
  namespace: string;
  name: string;
  version: string;
  mode?: string;
}): { archivePath: string; checksum: string } {
  const pluginDir = join(params.dir, `${params.name}-${params.version}`);
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });

  writeFileSync(
    join(pluginDir, 'plugin.yaml'),
    [
      `namespace: ${params.namespace}`,
      `name: ${params.name}`,
      `version: ${params.version}`,
      'runtime:',
      '  entrypoint: dist/index.js',
      'actions:',
      '  - name: run',
      '    description: run',
      '    input: {}',
      '    output: {}',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    join(pluginDir, 'dist', 'index.js'),
    [
      'const raw = await Bun.stdin.text();',
      'const payload = JSON.parse(raw || "{}");',
      'process.stdout.write(JSON.stringify({ ok: true, action: payload.action, mode: "' + (params.mode || params.version) + '" }));',
      '',
    ].join('\n'),
    'utf8',
  );

  const archivePath = join(params.dir, `${params.name}-${params.version}.tgz`);
  const tar = spawnSync('tar', ['-czf', archivePath, '-C', pluginDir, '.']);
  if (tar.status !== 0) {
    throw new Error(`Failed to create archive: ${tar.stderr?.toString() || tar.error?.message || 'tar error'}`);
  }

  const bytes = readFileSync(archivePath);
  const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  return { archivePath, checksum };
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

  it('should return stable JSON error object for invalid --server in --json mode', async () => {
    const result = await runCli([
      'workflow',
      'list',
      '--json',
      '--server',
      'bad/path',
      '--api-key',
      'k1',
    ]);

    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stderr);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('ERROR');
    expect(typeof parsed.error.message).toBe('string');
  });

  it('should return deterministic NOT_FOUND exit code and JSON error for plugin prepare missing plugin', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const result = await runCli(['plugin', 'prepare', 'missing-plugin', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });

      expect(result.code).toBe(4);
      const parsed = JSON.parse(result.stderr);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('NOT_FOUND');
      expect(parsed.error.message).toContain("missing-plugin");
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

  it('should trigger a workflow manually', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const wfPath = join(dir, 'wf-trigger.yaml');

      writeFileSync(
        wfPath,
        [
          'apiVersion: v1',
          'id: trigger-workflow',
          'enabled: true',
          'tasks:',
          '  - id: t1',
          '    type: example/plugin.action',
          '',
        ].join('\n'),
        'utf8',
      );

      const apply = await runCli(['workflow', 'apply', wfPath], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(apply.code).toBe(0);

      const trigger = await runCli(['workflow', 'trigger', 'trigger-workflow', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(trigger.code).toBe(0);

      const body = JSON.parse(trigger.stdout);
      expect(body.workflowId).toBe('trigger-workflow');
      expect(typeof body.executionId).toBe('string');
      expect(body.executionId.length).toBeGreaterThan(0);
      expect(body.status).toBe('ACCEPTED');
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
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const result = await runCli(['plugin', 'list', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });
      expect(result.code).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toEqual({ plugins: [] });
    });
  });

  it('should prepare plugin dependencies for one plugin', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const pluginDir = join(dir, 'plugins', 'sample-plugin');
      const pkgPath = join(pluginDir, 'package.json');

      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(pkgPath, JSON.stringify({ name: 'sample-plugin', version: '0.0.1' }, null, 2), 'utf8');

      const result = await runCli(['plugin', 'prepare', 'sample-plugin', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });

      expect(result.code).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.prepared).toBe(1);
      expect(parsed.plugins).toContain('sample-plugin');
    });
  });

  it('should return not-found when preparing an unknown plugin', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const result = await runCli(['plugin', 'prepare', 'missing-plugin', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey },
      });

      expect(result.code).toBe(4);
      const parsed = JSON.parse(result.stderr);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('NOT_FOUND');
      expect(parsed.error.message).toContain("Plugin 'missing-plugin' not found");
    });
  });

  it('should scaffold a plugin with plugin init', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-plugin-init-'));
    const result = await runCli(['plugin', 'init', 'dx-plugin', '--dir', './plugins', '--json'], { cwd: dir });

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.plugin.name).toBe('dx-plugin');
    expect(parsed.files).toEqual(expect.arrayContaining(['plugin.yaml', 'index.ts', 'package.json']));
  });

  it('should validate a scaffolded plugin', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-plugin-validate-'));
    const init = await runCli(['plugin', 'init', 'dx-plugin', '--dir', './plugins'], { cwd: dir });
    expect(init.code).toBe(0);

    const inputPath = join(dir, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ message: 'hi' }, null, 2), 'utf8');

    const pluginPath = join(dir, 'plugins', 'dx-plugin');
    const validate = await runCli(['plugin', 'validate', pluginPath, '--action', 'run', '--input', inputPath, '--json'], {
      cwd: dir,
    });

    expect(validate.code).toBe(0);
    const parsed = JSON.parse(validate.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe('run');
  });

  it('should run plugin dev once with runtime envelope', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-plugin-dev-'));
    const init = await runCli(['plugin', 'init', 'dx-plugin', '--dir', './plugins'], { cwd: dir });
    expect(init.code).toBe(0);

    const inputPath = join(dir, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ message: 'from-dev' }, null, 2), 'utf8');

    const pluginPath = join(dir, 'plugins', 'dx-plugin');
    const dev = await runCli(['plugin', 'dev', pluginPath, '--action', 'run', '--input', inputPath, '--json'], {
      cwd: dir,
    });

    expect(dev.code).toBe(0);
    const parsed = JSON.parse(dev.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe('run');
    expect(parsed.output.ok).toBe(true);
  });

  it('should fail plugin validate for invalid manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-plugin-invalid-manifest-'));
    const pluginDir = join(dir, 'broken-plugin');
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(join(pluginDir, 'plugin.yaml'), 'name: bad plugin\nversion: not-semver\nnamespace: core\nactions: []\n', 'utf8');
    writeFileSync(join(pluginDir, 'index.ts'), 'process.stdout.write("{}")\n', 'utf8');

    const result = await runCli(['plugin', 'validate', pluginDir, '--json'], { cwd: dir });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Invalid manifest');
  });

  it('should validate plugin using declared runtime entrypoint', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-cli-plugin-declared-entry-'));
    const pluginDir = join(dir, 'declared-entry');
    mkdirSync(join(pluginDir, 'dist'), { recursive: true });

    writeFileSync(
      join(pluginDir, 'plugin.yaml'),
      [
        'name: declared-entry',
        'version: 0.1.0',
        'namespace: core',
        'runtime:',
        '  entrypoint: dist/index.js',
        'actions:',
        '  - name: run',
        '    description: run',
        '    input: {}',
        '    output: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    writeFileSync(
      join(pluginDir, 'dist', 'index.js'),
      [
        'const raw = await Bun.stdin.text();',
        'const payload = JSON.parse(raw || "{}");',
        'if (payload.action !== "run") { throw new Error("bad action"); }',
        'process.stdout.write(JSON.stringify({ ok: true, mode: "declared" }));',
        '',
      ].join('\n'),
      'utf8',
    );

    const result = await runCli(['plugin', 'validate', pluginDir, '--action', 'run', '--json'], { cwd: dir });
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.output.mode).toBe('declared');
  });

  it('should install, list, and remove plugins with default rollback', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const v1 = createPluginArchive({ dir, namespace: 'core', name: 'sample', version: '0.1.0', mode: 'v1' });
      const v2 = createPluginArchive({ dir, namespace: 'core', name: 'sample', version: '0.2.0', mode: 'v2' });
      const env = { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey };

      const installV1 = await runCli(
        ['plugin', 'install', `url:${pathToFileURL(v1.archivePath).toString()}`, '--checksum', v1.checksum, '--json'],
        { cwd: dir, env },
      );
      expect(installV1.code).toBe(0);

      const installV2 = await runCli(
        ['plugin', 'install', `url:${pathToFileURL(v2.archivePath).toString()}`, '--checksum', v2.checksum, '--json'],
        { cwd: dir, env },
      );
      expect(installV2.code).toBe(0);

      const list = await runCli(['plugin', 'list', '--json'], { cwd: dir, env });
      expect(list.code).toBe(0);
      const listed = JSON.parse(list.stdout);
      expect(listed.plugins).toHaveLength(1);
      expect(listed.plugins[0].plugin).toBe('core/sample');
      expect(typeof listed.plugins[0].activeVersion).toBe('string');
      expect(typeof listed.plugins[0].previousVersion).toBe('string');
      expect(listed.plugins[0].versions).toHaveLength(2);

      const activeBefore = listed.plugins[0].activeVersion as string;
      const previousBefore = listed.plugins[0].previousVersion as string;

      const removeActive = await runCli(['plugin', 'remove', `core/sample@${activeBefore}`, '--json'], { cwd: dir, env });
      expect(removeActive.code).toBe(0);
      const removed = JSON.parse(removeActive.stdout);
      expect(removed.removed.rolledBackTo).toBe(previousBefore);
      expect(removed.removed.activeVersion).toBe(previousBefore);
    });
  });

  it('should fail plugin install when checksum mismatches', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const v1 = createPluginArchive({ dir, namespace: 'core', name: 'sample', version: '0.1.0', mode: 'v1' });
      const badChecksum = `sha256:${'0'.repeat(64)}`;

      const result = await runCli(
        ['plugin', 'install', `url:${pathToFileURL(v1.archivePath).toString()}`, '--checksum', badChecksum],
        { cwd: dir, env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey } },
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Checksum mismatch');
    });
  });

  it('should reject mutable github source references', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const result = await runCli(
        ['plugin', 'install', 'github:acme/repo@main', '--checksum', `sha256:${'a'.repeat(64)}`],
        { cwd: dir, env: { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey } },
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('immutable release tag');
    });
  });

  it('should keep active plugin state unchanged when install fails checksum verification', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const v1 = createPluginArchive({ dir, namespace: 'core', name: 'stable', version: '1.0.0', mode: 'stable' });
      const v2 = createPluginArchive({ dir, namespace: 'core', name: 'stable', version: '1.1.0', mode: 'broken' });
      const env = { AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey };

      const installStable = await runCli(
        ['plugin', 'install', `url:${pathToFileURL(v1.archivePath).toString()}`, '--checksum', v1.checksum, '--json'],
        { cwd: dir, env },
      );
      expect(installStable.code).toBe(0);

      const badInstall = await runCli(
        ['plugin', 'install', `url:${pathToFileURL(v2.archivePath).toString()}`, '--checksum', `sha256:${'f'.repeat(64)}`],
        { cwd: dir, env },
      );
      expect(badInstall.code).toBe(1);
      expect(badInstall.stderr).toContain('Checksum mismatch');

      const list = await runCli(['plugin', 'list', '--json'], { cwd: dir, env });
      expect(list.code).toBe(0);
      const parsed = JSON.parse(list.stdout);
      expect(parsed.plugins).toHaveLength(1);
      expect(parsed.plugins[0].activeVersion).toBe('1.0.0');
    });
  });

  it('should allow legacy local plugins to coexist with registry-installed plugins', async () => {
    await withTestServer(async ({ dir, baseUrl, apiKey }) => {
      const pluginsPath = join(dir, 'plugins');
      const legacyDir = join(pluginsPath, 'legacy');
      mkdirSync(legacyDir, { recursive: true });

      writeFileSync(
        join(legacyDir, 'plugin.yaml'),
        [
          'name: legacy',
          'version: 0.1.0',
          'namespace: core',
          'actions:',
          '  - name: run',
          '    description: run',
          '    input: {}',
          '    output: {}',
          '',
        ].join('\n'),
        'utf8',
      );

      writeFileSync(
        join(legacyDir, 'index.ts'),
        [
          'const raw = await Bun.stdin.text();',
          'const payload = JSON.parse(raw || "{}");',
          'if (payload.action !== "run") throw new Error("unsupported");',
          'process.stdout.write(JSON.stringify({ ok: true, mode: "legacy" }));',
          '',
        ].join('\n'),
        'utf8',
      );

      const legacyValidateBefore = await runCli(['plugin', 'validate', legacyDir, '--action', 'run', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_PLUGIN_PATHS: pluginsPath },
      });
      expect(legacyValidateBefore.code).toBe(0);

      const registryPlugin = createPluginArchive({ dir, namespace: 'core', name: 'registry-sample', version: '0.5.0' });
      const installRegistry = await runCli(
        ['plugin', 'install', `url:${pathToFileURL(registryPlugin.archivePath).toString()}`, '--checksum', registryPlugin.checksum, '--json'],
        { cwd: dir, env: { AUTOKESTRA_PLUGIN_PATHS: pluginsPath, AUTOKESTRA_SERVER_URL: baseUrl, AUTOKESTRA_API_KEY: apiKey } },
      );
      expect(installRegistry.code).toBe(0);

      const legacyValidateAfter = await runCli(['plugin', 'validate', legacyDir, '--action', 'run', '--json'], {
        cwd: dir,
        env: { AUTOKESTRA_PLUGIN_PATHS: pluginsPath },
      });
      expect(legacyValidateAfter.code).toBe(0);
      const legacyParsed = JSON.parse(legacyValidateAfter.stdout);
      expect(legacyParsed.output.mode).toBe('legacy');
    });
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