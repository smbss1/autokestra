import { Logger } from '@autokestra/plugin-sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type ShellType = 'bash' | 'sh';

type ErrorCode = 'SOURCE_ERROR' | 'EXECUTION_ERROR' | 'TIMEOUT';

export type ExecInput = {
  command?: string;
  script?: string;
  shell?: ShellType;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  workspacePath?: string;
  timeoutMs?: number;
};

export type ExecOutput = {
  success: boolean;
  shell: ShellType;
  command: {
    value: string;
    args: string[];
    workingDir: string;
    envKeys: string[];
  };
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  truncated: {
    stdout: boolean;
    stderr: boolean;
    maxBytes: number;
  };
};

export interface ExecutionContext {
  log: Logger;
}

export class BashPluginError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly phase: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BashPluginError';
  }
}

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export function trimOutput(text: string, maxBytes = MAX_OUTPUT_BYTES): { value: string; truncated: boolean } {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return { value: text, truncated: false };
  return { value: buffer.subarray(0, maxBytes).toString('utf8'), truncated: true };
}

function resolveWorkingDir(input: ExecInput): string {
  const baseWorkspace =
    (typeof input.workspacePath === 'string' && input.workspacePath.trim().length > 0
      ? input.workspacePath
      : process.env.AUTOKESTRA_WORKSPACE_PATH) || process.cwd();

  const workspacePath = path.resolve(baseWorkspace);
  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
    throw new BashPluginError('SOURCE_ERROR', 'resolve', `Workspace directory not found: ${workspacePath}`);
  }

  if (!input.cwd || input.cwd.trim().length === 0) {
    return workspacePath;
  }

  const resolved = path.resolve(workspacePath, input.cwd);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new BashPluginError('SOURCE_ERROR', 'resolve', `Working directory not found: ${resolved}`);
  }

  return resolved;
}

function buildCommand(input: ExecInput): { value: string; args: string[]; shell: ShellType } {
  const shell = input.shell ?? 'bash';
  const args = input.args ?? [];

  if (input.command && input.command.trim().length > 0) {
    const merged = [input.command, ...args.map(shellEscape)].join(' ').trim();
    return { value: merged, args, shell };
  }

  const script = input.script!.trim();
  if (args.length === 0) {
    return { value: script, args, shell };
  }

  const withArgs = `${script}\n# positional args supplied by Autokestra: ${args.map(shellEscape).join(' ')}`;
  return { value: withArgs, args, shell };
}

function shellEscape(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function executeShell(params: {
  shell: ShellType;
  command: string;
  cwd: string;
  env?: Record<string, string>;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean; durationMs: number }> {
  const started = Date.now();

  const proc = Bun.spawn([params.shell, '-lc', params.command], {
    cwd: params.cwd,
    env: { ...process.env, ...(params.env || {}) },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let timer: NodeJS.Timeout | undefined;
  let timedOut = false;

  try {
    const executionPromise = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]).then(([stdout, stderr, exitCode]) => ({
      stdout,
      stderr,
      exitCode,
      timedOut: false,
      durationMs: Date.now() - started,
    }));

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill();
        } catch {
          // no-op
        }
        reject(new BashPluginError('TIMEOUT', 'execute', `Command timed out after ${params.timeoutMs}ms`));
      }, params.timeoutMs);
    });

    return await Promise.race([executionPromise, timeoutPromise]);
  } catch (error) {
    if (timedOut) {
      return {
        stdout: '',
        stderr: '',
        exitCode: 124,
        timedOut: true,
        durationMs: Date.now() - started,
      };
    }

    if (error instanceof BashPluginError) throw error;
    throw new BashPluginError('EXECUTION_ERROR', 'execute', error instanceof Error ? error.message : String(error));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function executeExec(input: ExecInput, context: ExecutionContext): Promise<ExecOutput> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const workingDir = resolveWorkingDir(input);
  const command = buildCommand(input);

  context.log.info('Starting shell execution', {
    shell: command.shell,
    cwd: workingDir,
    hasEnv: Boolean(input.env && Object.keys(input.env).length > 0),
  });

  const result = await executeShell({
    shell: command.shell,
    command: command.value,
    cwd: workingDir,
    env: input.env,
    timeoutMs,
  });

  const stdout = trimOutput(result.stdout, MAX_OUTPUT_BYTES);
  const stderr = trimOutput(result.stderr, MAX_OUTPUT_BYTES);
  const success = !result.timedOut && result.exitCode === 0;

  const output: ExecOutput = {
    success,
    shell: command.shell,
    command: {
      value: command.value,
      args: command.args,
      workingDir,
      envKeys: Object.keys(input.env || {}),
    },
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    stdout: stdout.value,
    stderr: stderr.value,
    truncated: {
      stdout: stdout.truncated,
      stderr: stderr.truncated,
      maxBytes: MAX_OUTPUT_BYTES,
    },
  };

  if (!output.success) {
    context.log.error('Shell execution failed', {
      exitCode: output.exitCode,
      timedOut: output.timedOut,
      shell: output.shell,
      command: output.command.value,
    });
  } else {
    context.log.info('Shell execution succeeded', {
      exitCode: output.exitCode,
      durationMs: output.durationMs,
    });
  }

  return output;
}