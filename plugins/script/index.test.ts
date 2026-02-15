import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  executeRun,
  planLifecycleScripts,
  resolveInstallBehavior,
  selectRuntime,
  trimOutput,
  validateRunInput,
} from './core';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe('script plugin validation', () => {
  test('rejects unsupported startCommand', () => {
    expect(() =>
      validateRunInput({
        source: { type: 'inline', language: 'js', content: 'console.log(1)' },
        startCommand: 'node server.js',
      })
    ).toThrow(/not supported/i);
  });

  test('requires entry for non-project local mode', () => {
    expect(() =>
      validateRunInput({
        source: { type: 'local', path: '/tmp' },
        projectMode: false,
      })
    ).toThrow(/entry is required/i);
  });

  test('rejects git source and directs to git-source plugin', () => {
    expect(() =>
      validateRunInput({
        source: { type: 'git', repoUrl: 'https://example.com/repo.git' },
        projectMode: true,
      })
    ).toThrow(/core\/git-source\.checkout/i);
  });
});

describe('runtime selection', () => {
  test('supports explicit bun and tsx', () => {
    expect(selectRuntime('bun', () => true)).toBe('bun');
    expect(selectRuntime('tsx', () => true)).toBe('tsx');
  });

  test('auto prefers bun then tsx', () => {
    expect(selectRuntime('auto', (cmd) => cmd === 'bun')).toBe('bun');
    expect(selectRuntime('auto', (cmd) => cmd === 'tsx')).toBe('tsx');
  });
});

describe('project lifecycle planning', () => {
  test('fails when required start script is missing', () => {
    expect(() => planLifecycleScripts({ prestart: 'echo pre' }, { runStart: true })).toThrow(/Missing package\.json script 'start'/);
  });

  test('allows missing optional pre/post scripts', () => {
    const plan = planLifecycleScripts({ start: 'node index.js' }, { runPrestart: true, runStart: true, runPoststart: true });
    expect(plan.find((item) => item.name === 'prestart')?.run).toBe(false);
    expect(plan.find((item) => item.name === 'start')?.run).toBe(true);
    expect(plan.find((item) => item.name === 'poststart')?.run).toBe(false);
  });
});

describe('install behavior', () => {
  test('install.enabled=false overrides lockfile', () => {
    const behavior = resolveInstallBehavior({ enabled: false, tool: 'npm' }, true);
    expect(behavior.runInstall).toBe(false);
    expect(behavior.reason).toBe('disabled-even-with-lockfile');
  });
});

describe('output truncation', () => {
  test('caps output content at byte limit', () => {
    const source = 'a'.repeat(32);
    const trimmed = trimOutput(source, 16);
    expect(trimmed.truncated).toBe(true);
    expect(Buffer.from(trimmed.value).length).toBe(16);
  });
});

describe('executeRun behavior', () => {
  test('emits phase output logs during execution', async () => {
    const captured: string[] = [];
    const captureLogger = {
      info: (message: string, ...args: any[]) => captured.push([message, ...args].join(' ')),
      warn: (message: string, ...args: any[]) => captured.push([message, ...args].join(' ')),
      error: () => undefined,
      debug: () => undefined,
    };

    const output = await executeRun(
      {
        source: {
          type: 'inline',
          language: 'js',
          content: 'console.log("live-log-line")',
        },
        runtime: 'bun',
        timeoutMs: 20_000,
      },
      { log: captureLogger }
    );

    expect(output.success).toBe(true);
    expect(captured.some((line) => line.includes('Phase output [inline] live-log-line'))).toBe(true);
  });

  test('classifies missing start script in project mode', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autokestra-script-test-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'x', version: '0.0.0', scripts: { prestart: 'echo pre' } }),
        'utf8'
      );

      await expect(
        executeRun(
          {
            source: { type: 'local', path: tempDir },
            projectMode: true,
            timeoutMs: 20_000,
          },
          { log: logger }
        )
      ).rejects.toThrow(/SCRIPT_NOT_FOUND/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('returns timeout error code when command exceeds timeout', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autokestra-script-timeout-test-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'x', version: '0.0.0', scripts: { start: 'echo start' } }),
        'utf8'
      );

      await expect(
        executeRun(
          {
            source: { type: 'local', path: tempDir },
            projectMode: true,
            install: {
              enabled: true,
              command: 'sleep 1',
            },
            timeoutMs: 50,
          },
          { log: logger }
        )
      ).rejects.toThrow(/TIMEOUT/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
