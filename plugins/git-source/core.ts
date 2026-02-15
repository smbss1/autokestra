import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

type ErrorCode = 'VALIDATION_ERROR' | 'GIT_AUTH_ERROR' | 'GIT_CLONE_ERROR' | 'TIMEOUT';

type SourceAuth = {
  method: 'token' | 'ssh';
  token?: string;
  username?: string;
  privateKey?: string;
  knownHosts?: string;
};

export type CheckoutInput = {
  repoUrl: string;
  ref?: string;
  subdir?: string;
  auth?: SourceAuth;
  timeoutMs?: number;
};

export type CheckoutOutput = {
  success: true;
  workspacePath: string;
  repoUrl: string;
  ref?: string;
  commit: string;
  subdir?: string;
};

export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface ExecutionContext {
  log: Logger;
}

export class GitSourceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly phase: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GitSourceError';
  }
}

const DEFAULT_TIMEOUT_MS = 120000;

export function validateCheckoutInput(input: unknown): CheckoutInput {
  if (!input || typeof input !== 'object') {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', 'Invalid input: expected object');
  }

  const candidate = input as CheckoutInput;
  if (!candidate.repoUrl || candidate.repoUrl.trim().length === 0) {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', 'repoUrl is required');
  }

  if (candidate.timeoutMs !== undefined && (!Number.isFinite(candidate.timeoutMs) || candidate.timeoutMs <= 0)) {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', 'timeoutMs must be a positive number');
  }

  if (candidate.auth?.method === 'token' && (!candidate.auth.token || candidate.auth.token.trim().length === 0)) {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', 'auth.token is required when auth.method=token');
  }

  if (candidate.auth?.method === 'ssh' && (!candidate.auth.privateKey || candidate.auth.privateKey.trim().length === 0)) {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', 'auth.privateKey is required when auth.method=ssh');
  }

  return candidate;
}

type CommandRun = {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeoutMs: number;
};

type CommandRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

async function runCommand(run: CommandRun): Promise<CommandRunResult> {
  const startedAt = Date.now();
  const proc = Bun.spawn([run.command, ...run.args], {
    cwd: run.cwd,
    env: { ...process.env, ...(run.env || {}) },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let timer: NodeJS.Timeout | undefined;

  try {
    const executionPromise = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]).then(([stdout, stderr, exitCode]) => ({
      stdout,
      stderr,
      exitCode,
      durationMs: Date.now() - startedAt,
    }));

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // no-op
        }
        reject(new GitSourceError('TIMEOUT', 'checkout', `Command timed out after ${run.timeoutMs}ms`, { command: run.command }));
      }, run.timeoutMs);
    });

    return await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ensureDirectory(directoryPath: string): void {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', `Directory not found: ${directoryPath}`);
  }
}

function resolveWorkspacePath(basePath: string, subdir?: string): string {
  const root = path.resolve(basePath);
  ensureDirectory(root);

  if (!subdir || subdir.trim().length === 0) {
    return root;
  }

  const joined = path.resolve(root, subdir);
  ensureDirectory(joined);
  return joined;
}

function buildTokenAuthUrl(repoUrl: string, auth: SourceAuth): string {
  let parsed: URL;
  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', `Invalid git repo URL: ${repoUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new GitSourceError('VALIDATION_ERROR', 'resolve', 'Token auth requires an https repository URL');
  }

  parsed.username = auth.username?.trim() || 'x-access-token';
  parsed.password = auth.token || '';
  return parsed.toString();
}

type SshPrepared = {
  env: Record<string, string>;
  cleanupPaths: string[];
};

async function prepareSshEnv(auth: SourceAuth): Promise<SshPrepared> {
  const keyPath = path.join(os.tmpdir(), `autokestra-git-key-${randomUUID()}`);
  await fsp.writeFile(keyPath, auth.privateKey || '', 'utf8');
  await fsp.chmod(keyPath, 0o600);

  const cleanupPaths = [keyPath];
  const commandParts = ['ssh', '-i', keyPath, '-o', 'IdentitiesOnly=yes'];

  if (auth.knownHosts && auth.knownHosts.trim().length > 0) {
    const knownHostsPath = path.join(os.tmpdir(), `autokestra-known-hosts-${randomUUID()}`);
    await fsp.writeFile(knownHostsPath, auth.knownHosts, 'utf8');
    cleanupPaths.push(knownHostsPath);
    commandParts.push('-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${knownHostsPath}`);
  } else {
    commandParts.push('-o', 'StrictHostKeyChecking=no');
  }

  return {
    env: {
      GIT_SSH_COMMAND: commandParts.join(' '),
    },
    cleanupPaths,
  };
}

function mapGitError(auth: SourceAuth | undefined, stderr: string, phase: string): GitSourceError {
  if (auth) {
    return new GitSourceError('GIT_AUTH_ERROR', phase, stderr || 'Git auth operation failed');
  }
  return new GitSourceError('GIT_CLONE_ERROR', phase, stderr || 'Git clone operation failed');
}

export async function executeCheckout(inputRaw: unknown, context: ExecutionContext): Promise<CheckoutOutput> {
  const input = validateCheckoutInput(inputRaw);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autokestra-git-source-'));
  const cloneDir = path.join(rootDir, 'repo');

  let repoUrl = input.repoUrl;
  let env: Record<string, string> = {};
  const cleanupPaths: string[] = [];

  try {
    if (input.auth?.method === 'token') {
      repoUrl = buildTokenAuthUrl(input.repoUrl, input.auth);
    }

    if (input.auth?.method === 'ssh') {
      const ssh = await prepareSshEnv(input.auth);
      env = ssh.env;
      cleanupPaths.push(...ssh.cleanupPaths);
    }

    context.log.info('Git checkout start', { repoUrl: input.repoUrl, ref: input.ref });

    const cloneResult = await runCommand({
      command: 'git',
      args: ['clone', '--depth', '1', repoUrl, cloneDir],
      cwd: process.cwd(),
      env,
      timeoutMs,
    });

    if (cloneResult.exitCode !== 0) {
      throw mapGitError(input.auth, cloneResult.stderr, 'clone');
    }

    if (input.ref && input.ref.trim().length > 0) {
      const checkoutResult = await runCommand({
        command: 'git',
        args: ['checkout', input.ref],
        cwd: cloneDir,
        env,
        timeoutMs,
      });

      if (checkoutResult.exitCode !== 0) {
        throw mapGitError(input.auth, checkoutResult.stderr, 'checkout');
      }
    }

    const commitResult = await runCommand({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      cwd: cloneDir,
      env,
      timeoutMs: Math.min(timeoutMs, 5000),
    });

    if (commitResult.exitCode !== 0) {
      throw mapGitError(input.auth, commitResult.stderr, 'commit');
    }

    const workspacePath = resolveWorkspacePath(cloneDir, input.subdir);

    context.log.info('Git checkout complete', {
      workspacePath,
      commit: commitResult.stdout.trim(),
    });

    return {
      success: true,
      workspacePath,
      repoUrl: input.repoUrl,
      ref: input.ref,
      commit: commitResult.stdout.trim(),
      subdir: input.subdir,
    };
  } catch (err) {
    const normalized = err instanceof GitSourceError
      ? err
      : new GitSourceError('GIT_CLONE_ERROR', 'checkout', err instanceof Error ? err.message : String(err));

    context.log.error('Git source plugin failed', {
      code: normalized.code,
      phase: normalized.phase,
      message: normalized.message,
    });

    throw new Error(
      JSON.stringify({
        code: normalized.code,
        phase: normalized.phase,
        message: normalized.message,
      })
    );
  } finally {
    for (const filePath of cleanupPaths) {
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
      } catch {
        // best effort
      }
    }
  }
}

export function createRuntimeLogger(taskPrefix?: string): Logger {
  const write = (level: string, message: string, metadata?: Record<string, unknown>) => {
    const payload = {
      timestamp: Date.now(),
      level,
      message: taskPrefix ? `${taskPrefix} ${message}` : message,
      ...(metadata ? { metadata } : {}),
    };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  };

  return {
    info: (message: string, ...args: any[]) => write('INFO', format(message, args)),
    warn: (message: string, ...args: any[]) => write('WARN', format(message, args)),
    error: (message: string, ...args: any[]) => write('ERROR', format(message, args)),
    debug: (message: string, ...args: any[]) => write('DEBUG', format(message, args)),
  };
}

function format(message: string, args: any[]): string {
  if (!args?.length) return message;
  try {
    return `${message} ${args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')}`;
  } catch {
    return message;
  }
}
