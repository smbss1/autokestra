import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeExec } from './core';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe('bash plugin execution', () => {
  test('executes command successfully', async () => {
    const output = await executeExec(
      {
        command: 'echo bash-ok',
        shell: 'bash',
        timeoutMs: 10_000,
      },
      { log: logger }
    );

    expect(output.success).toBe(true);
    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain('bash-ok');
  });

  test('executes inline script with sh', async () => {
    const output = await executeExec(
      {
        script: 'echo line1\necho line2',
        shell: 'sh',
        timeoutMs: 10_000,
      },
      { log: logger }
    );

    expect(output.success).toBe(true);
    expect(output.shell).toBe('sh');
    expect(output.stdout).toContain('line1');
    expect(output.stdout).toContain('line2');
  });

  test('non-zero exit marks failure', async () => {
    const output = await executeExec(
      {
        command: 'exit 12',
        shell: 'bash',
        timeoutMs: 10_000,
      },
      { log: logger }
    );

    expect(output.success).toBe(false);
    expect(output.exitCode).toBe(12);
  });

  test('timeout marks failure', async () => {
    const output = await executeExec(
      {
        command: 'sleep 1',
        shell: 'sh',
        timeoutMs: 50,
      },
      { log: logger }
    );

    expect(output.success).toBe(false);
    expect(output.timedOut).toBe(true);
  });

  test('truncates long stdout', async () => {
    const output = await executeExec(
      {
        command: "head -c 1200000 < /dev/zero | tr '\\0' 'a'",
        shell: 'bash',
        timeoutMs: 10_000,
      },
      { log: logger }
    );

    expect(output.success).toBe(true);
    expect(output.truncated.stdout).toBe(true);
    expect(Buffer.from(output.stdout, 'utf8').length).toBe(output.truncated.maxBytes);
  });

  test('defaults cwd to workspacePath when cwd omitted', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'autokestra-bash-workspace-'));
    try {
      fs.writeFileSync(path.join(workspace, 'hello.txt'), 'hello', 'utf8');
      const output = await executeExec(
        {
          command: 'pwd',
          shell: 'bash',
          workspacePath: workspace,
          timeoutMs: 10_000,
        },
        { log: logger }
      );

      expect(output.success).toBe(true);
      expect(output.command.workingDir).toBe(path.resolve(workspace));
      expect(output.stdout).toContain(path.resolve(workspace));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('trusted mode behavior: arbitrary command is not allowlist-blocked', async () => {
    const output = await executeExec(
      {
        command: 'echo allowed-command && uname -s',
        shell: 'bash',
        timeoutMs: 10_000,
      },
      { log: logger }
    );

    expect(output.success).toBe(true);
    expect(output.stdout).toContain('allowed-command');
  });
});
