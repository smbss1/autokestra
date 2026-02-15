import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeCheckout, validateCheckoutInput } from './core';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe('git-source validation', () => {
  test('requires repoUrl', () => {
    expect(() => validateCheckoutInput({})).toThrow(/repoUrl is required/i);
  });

  test('requires token when auth.method=token', () => {
    expect(() =>
      validateCheckoutInput({
        repoUrl: 'https://example.com/repo.git',
        auth: { method: 'token' },
      })
    ).toThrow(/auth.token is required/i);
  });

  test('requires privateKey when auth.method=ssh', () => {
    expect(() =>
      validateCheckoutInput({
        repoUrl: 'git@github.com:acme/repo.git',
        auth: { method: 'ssh' },
      })
    ).toThrow(/auth.privateKey is required/i);
  });
});

describe('git-source checkout', () => {
  test('clones a local repository (public flow)', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'autokestra-git-src-repo-'));
    const originDir = path.join(repoRoot, 'origin');
    fs.mkdirSync(originDir, { recursive: true });

    const run = (command: string, cwd: string) =>
      Bun.spawnSync(['bash', '-lc', command], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
        },
      });

    try {
      expect(run('git init .', originDir).exitCode).toBe(0);
      fs.writeFileSync(path.join(originDir, 'README.md'), '# hello\n', 'utf8');
      expect(run('git add README.md', originDir).exitCode).toBe(0);
      expect(run('git commit -m "init"', originDir).exitCode).toBe(0);

      const output = await executeCheckout(
        {
          repoUrl: originDir,
          timeoutMs: 20_000,
        },
        { log: logger }
      );

      expect(output.success).toBe(true);
      expect(output.workspacePath.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(output.workspacePath, 'README.md'))).toBe(true);
      expect(output.commit.length).toBeGreaterThan(6);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('maps token clone failures to GIT_AUTH_ERROR', async () => {
    await expect(
      executeCheckout(
        {
          repoUrl: 'https://127.0.0.1:1/nonexistent/repo.git',
          auth: { method: 'token', token: 'dummy' },
          timeoutMs: 2_000,
        },
        { log: logger }
      )
    ).rejects.toThrow(/GIT_AUTH_ERROR/);
  });
});
