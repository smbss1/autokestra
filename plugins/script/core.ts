import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

type SourceType = 'local' | 'git' | 'inline';
type RuntimeSelection = 'auto' | 'bun' | 'tsx';
type RuntimeResolved = 'bun' | 'tsx';
type InstallTool = 'npm' | 'pnpm' | 'yarn' | 'bun';
type ExecMode = 'project' | 'entry' | 'inline';
type PhaseName = 'install' | 'prestart' | 'start' | 'poststart' | 'entry' | 'inline';

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'SOURCE_ERROR'
  | 'GIT_AUTH_ERROR'
  | 'GIT_CLONE_ERROR'
  | 'INSTALL_ERROR'
  | 'RUNTIME_NOT_FOUND'
  | 'SCRIPT_NOT_FOUND'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT';

type SourceAuth = {
  method: 'token' | 'ssh';
  token?: string;
  username?: string;
  privateKey?: string;
  knownHosts?: string;
};

type SourceInput = {
  type: SourceType;
  path?: string;
  repoUrl?: string;
  ref?: string;
  subdir?: string;
  auth?: SourceAuth;
  language?: 'js' | 'ts';
  content?: string;
};

type InstallInput = {
  enabled: boolean;
  tool?: InstallTool;
  packages?: string[];
  command?: string;
};

type LifecycleInput = {
  runPrestart?: boolean;
  runStart?: boolean;
  runPoststart?: boolean;
};

export type RunInput = {
  source: SourceInput;
  projectMode?: boolean;
  runtime?: RuntimeSelection;
  install?: InstallInput;
  lifecycle?: LifecycleInput;
  entry?: string;
  args?: string[];
  env?: Record<string, string>;
  workingDir?: string;
  timeoutMs?: number;
  startCommand?: string;
};

type PhaseResult = {
  name: PhaseName;
  command: string;
  skipped: boolean;
  exitCode?: number;
  durationMs?: number;
  startedAt?: string;
  endedAt?: string;
};

export type RunOutput = {
  success: true;
  mode: ExecMode;
  source: {
    type: SourceType;
    workspacePath: string;
    repoUrl?: string;
    ref?: string;
    commit?: string;
    subdir?: string;
  };
  runtime: {
    selected: RuntimeResolved;
    installTool: InstallTool | 'none';
    projectMode: boolean;
  };
  lifecycle: {
    phases: PhaseResult[];
    executed: string[];
    skipped: string[];
  };
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

export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface ExecutionContext {
  log: Logger;
}

export class ScriptPluginError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly phase: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScriptPluginError';
  }
}

const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120000;

function commandExists(command: string): boolean {
  const result = Bun.spawnSync(['bash', '-lc', `command -v ${command}`], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return result.exitCode === 0;
}

export function selectRuntime(runtime: RuntimeSelection | undefined, exists = commandExists): RuntimeResolved {
  const requested = runtime ?? 'auto';

  if (requested === 'bun') {
    return 'bun';
  }

  if (requested === 'tsx') {
    return 'tsx';
  }

  if (exists('bun')) return 'bun';
  if (exists('tsx')) return 'tsx';
  throw new ScriptPluginError('RUNTIME_NOT_FOUND', 'resolve', 'No compatible runtime found (bun or tsx)');
}

export function resolveInstallBehavior(install: InstallInput | undefined, lockfilePresent: boolean) {
  if (install?.enabled === false) {
    return { runInstall: false, reason: lockfilePresent ? 'disabled-even-with-lockfile' : 'disabled' as const };
  }

  if (install?.enabled === true) {
    return { runInstall: true, reason: 'enabled' as const };
  }

  return { runInstall: false, reason: lockfilePresent ? 'default-skip-with-lockfile' : 'default-skip' as const };
}

function lockfileExists(workspacePath: string): boolean {
  const candidates = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'];
  return candidates.some((name) => fs.existsSync(path.join(workspacePath, name)));
}

export function trimOutput(text: string, maxBytes = MAX_OUTPUT_BYTES): { value: string; truncated: boolean } {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) {
    return { value: text, truncated: false };
  }
  return { value: buffer.subarray(0, maxBytes).toString('utf8'), truncated: true };
}

function normalizeError(err: unknown, fallbackPhase: string): ScriptPluginError {
  if (err instanceof ScriptPluginError) return err;
  if (err instanceof Error) return new ScriptPluginError('EXECUTION_ERROR', fallbackPhase, err.message);
  return new ScriptPluginError('EXECUTION_ERROR', fallbackPhase, String(err));
}

export function validateRunInput(input: unknown): RunInput {
  if (!input || typeof input !== 'object') {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'Invalid input: expected object');
  }

  const candidate = input as RunInput;

  if (candidate.startCommand !== undefined) {
    throw new ScriptPluginError(
      'VALIDATION_ERROR',
      'resolve',
      "Input 'startCommand' is not supported in v1; use package.json scripts with lifecycle flags"
    );
  }

  if (!candidate.source || typeof candidate.source !== 'object') {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', "Missing required input 'source'");
  }

  const source = candidate.source;
  if (!['local', 'git', 'inline'].includes(source.type)) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', "source.type must be one of: local, git, inline");
  }

  if (source.type === 'local') {
    if (!source.path || source.path.trim().length === 0) {
      throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', "source.path is required for source.type=local");
    }
  }

  if (source.type === 'git') {
    if (!source.repoUrl || source.repoUrl.trim().length === 0) {
      throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', "source.repoUrl is required for source.type=git");
    }

    if (source.auth?.method === 'token' && (!source.auth.token || source.auth.token.trim().length === 0)) {
      throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'source.auth.token is required when method=token');
    }

    if (source.auth?.method === 'ssh' && (!source.auth.privateKey || source.auth.privateKey.trim().length === 0)) {
      throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'source.auth.privateKey is required when method=ssh');
    }
  }

  if (source.type === 'inline') {
    if (!source.language || !['js', 'ts'].includes(source.language)) {
      throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', "source.language must be 'js' or 'ts' for inline source");
    }
    if (!source.content || source.content.trim().length === 0) {
      throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'source.content is required for inline source');
    }
  }

  if (candidate.timeoutMs !== undefined && (!Number.isFinite(candidate.timeoutMs) || candidate.timeoutMs <= 0)) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'timeoutMs must be a positive number');
  }

  if (candidate.args && (!Array.isArray(candidate.args) || !candidate.args.every((arg) => typeof arg === 'string'))) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'args must be an array of strings');
  }

  if (candidate.env && typeof candidate.env !== 'object') {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'env must be an object of string values');
  }

  if (!candidate.projectMode && source.type !== 'inline' && (!candidate.entry || candidate.entry.trim().length === 0)) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'entry is required when projectMode=false and source is not inline');
  }

  return candidate;
}

export function planLifecycleScripts(
  scripts: Record<string, string> | undefined,
  lifecycle: LifecycleInput | undefined
): Array<{ name: 'prestart' | 'start' | 'poststart'; run: boolean; required: boolean }> {
  const runPrestart = lifecycle?.runPrestart ?? true;
  const runStart = lifecycle?.runStart ?? true;
  const runPoststart = lifecycle?.runPoststart ?? true;

  const hasPrestart = Boolean(scripts?.prestart);
  const hasStart = Boolean(scripts?.start);
  const hasPoststart = Boolean(scripts?.poststart);

  if (runStart && !hasStart) {
    throw new ScriptPluginError('SCRIPT_NOT_FOUND', 'start', "Missing package.json script 'start'");
  }

  return [
    { name: 'prestart', run: runPrestart && hasPrestart, required: false },
    { name: 'start', run: runStart && hasStart, required: runStart },
    { name: 'poststart', run: runPoststart && hasPoststart, required: false },
  ];
}

function buildScriptCommand(tool: InstallTool, scriptName: string): { command: string; args: string[] } {
  if (tool === 'bun') return { command: 'bun', args: ['run', scriptName] };
  if (tool === 'pnpm') return { command: 'pnpm', args: ['run', scriptName] };
  if (tool === 'yarn') return { command: 'yarn', args: ['run', scriptName] };
  return { command: 'npm', args: ['run', scriptName] };
}

function buildInstallCommand(install: InstallInput): { command: string; args: string[]; shell?: boolean } {
  const tool = install.tool ?? 'npm';

  if (install.command && install.command.trim().length > 0) {
    return { command: install.command, args: [], shell: true };
  }

  if (install.packages && install.packages.length > 0) {
    if (tool === 'bun') return { command: 'bun', args: ['add', ...install.packages] };
    if (tool === 'pnpm') return { command: 'pnpm', args: ['add', ...install.packages] };
    if (tool === 'yarn') return { command: 'yarn', args: ['add', ...install.packages] };
    return { command: 'npm', args: ['install', ...install.packages] };
  }

  if (tool === 'bun') return { command: 'bun', args: ['install'] };
  if (tool === 'pnpm') return { command: 'pnpm', args: ['install'] };
  if (tool === 'yarn') return { command: 'yarn', args: ['install'] };
  return { command: 'npm', args: ['install'] };
}

function ensureDirectory(directoryPath: string): void {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new ScriptPluginError('SOURCE_ERROR', 'resolve', `Directory not found: ${directoryPath}`);
  }
}

function resolveWorkspacePath(basePath: string, workingDir?: string): string {
  const root = path.resolve(basePath);
  ensureDirectory(root);

  if (!workingDir || workingDir.trim().length === 0) {
    return root;
  }

  const joined = path.resolve(root, workingDir);
  ensureDirectory(joined);
  return joined;
}

function buildTokenAuthUrl(repoUrl: string, auth: SourceAuth): string {
  let parsed: URL;
  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', `Invalid git repo URL: ${repoUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'Token auth requires an https repository URL');
  }

  parsed.username = encodeURIComponent(auth.username?.trim() || 'x-access-token');
  parsed.password = encodeURIComponent(auth.token || '');
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

type CommandRun = {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeoutMs: number;
  shell?: boolean;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
};

type CommandRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  onLine?: (line: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let allText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      allText += chunk;
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      if (onLine) {
        for (const line of lines) {
          const normalized = line.replace(/\r$/, '');
          if (normalized.length > 0) {
            onLine(normalized);
          }
        }
      }
    }

    const last = decoder.decode();
    if (last.length > 0) {
      allText += last;
      buffer += last;
    }

    if (onLine && buffer.length > 0) {
      const normalized = buffer.replace(/\r$/, '');
      if (normalized.length > 0) {
        onLine(normalized);
      }
    }

    return allText;
  } finally {
    reader.releaseLock();
  }
}

function shortenLine(line: string, maxLength = 2000): string {
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength)}...[TRUNCATED]`;
}

async function runCommand(run: CommandRun): Promise<CommandRunResult> {
  const startedAt = Date.now();


  const proc = run.shell
    ? Bun.spawn(['bash', '-lc', run.command], {
        cwd: run.cwd,
        env: { ...process.env, ...(run.env || {}) },
        stdout: 'pipe',
        stderr: 'pipe',
      })
    : Bun.spawn([run.command, ...run.args], {
        cwd: run.cwd,
        env: { ...process.env, ...(run.env || {}) },
        stdout: 'pipe',
        stderr: 'pipe',
      });

  let timer: NodeJS.Timeout | undefined;

  try {
    const executionPromise = Promise.all([
      consumeStream(proc.stdout, run.onStdoutLine),
      consumeStream(proc.stderr, run.onStderrLine),
      proc.exited,
    ]).then(([stdout, stderr, exitCode]) => ({
      stdout,
      stderr,
      exitCode,
      durationMs: Date.now() - startedAt,
    }));

    if (run.timeoutMs <= 0) {
      return await executionPromise;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // no-op
        }
        reject(new ScriptPluginError('TIMEOUT', 'execute', `Command timed out after ${run.timeoutMs}ms`, { command: run.command }));
      }, run.timeoutMs);
    });

    return await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ResolvedSource = {
  mode: ExecMode;
  workspacePath: string;
  entryPath?: string;
  sourceSummary: {
    type: SourceType;
    repoUrl?: string;
    ref?: string;
    commit?: string;
    subdir?: string;
  };
  cleanupPaths: string[];
};

async function resolveSource(input: RunInput, baseTempDir: string): Promise<ResolvedSource> {
  const source = input.source;

  if (source.type === 'local') {
    const workspacePath = resolveWorkspacePath(source.path || '', input.workingDir);
    return {
      mode: input.projectMode ? 'project' : 'entry',
      workspacePath,
      sourceSummary: {
        type: 'local',
      },
      cleanupPaths: [],
    };
  }

  if (source.type === 'inline') {
    const tmpDir = fs.mkdtempSync(path.join(baseTempDir, 'inline-'));
    const extension = source.language === 'ts' ? 'ts' : 'js';
    const entryPath = path.join(tmpDir, `main.${extension}`);
    fs.writeFileSync(entryPath, source.content || '', 'utf8');

    return {
      mode: 'inline',
      workspacePath: tmpDir,
      entryPath,
      sourceSummary: {
        type: 'inline',
      },
      cleanupPaths: [tmpDir],
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(baseTempDir, 'git-'));
  const cloneDir = path.join(tmpDir, 'repo');

  let repoUrl = source.repoUrl || '';
  let extraEnv: Record<string, string> = {};
  const cleanupPaths: string[] = [tmpDir];

  if (source.auth?.method === 'token') {
    repoUrl = buildTokenAuthUrl(repoUrl, source.auth);
  }

  if (source.auth?.method === 'ssh') {
    const prepared = await prepareSshEnv(source.auth);
    extraEnv = prepared.env;
    cleanupPaths.push(...prepared.cleanupPaths);
  }

  const cloneResult = await runCommand({
    command: 'git',
    args: ['clone', '--depth', '1', repoUrl, cloneDir],
    cwd: process.cwd(),
    env: extraEnv,
    timeoutMs: Math.max(1, input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (cloneResult.exitCode !== 0) {
    const code: ErrorCode = source.auth ? 'GIT_AUTH_ERROR' : 'GIT_CLONE_ERROR';
    throw new ScriptPluginError(code, 'clone', cloneResult.stderr || 'Failed to clone repository');
  }

  if (source.ref && source.ref.trim().length > 0) {
    const checkoutResult = await runCommand({
      command: 'git',
      args: ['checkout', source.ref],
      cwd: cloneDir,
      env: extraEnv,
      timeoutMs: Math.max(1, input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (checkoutResult.exitCode !== 0) {
      const code: ErrorCode = source.auth ? 'GIT_AUTH_ERROR' : 'GIT_CLONE_ERROR';
      throw new ScriptPluginError(code, 'clone', checkoutResult.stderr || `Failed to checkout ref ${source.ref}`);
    }
  }

  let commit = '';
  const commitResult = await runCommand({
    command: 'git',
    args: ['rev-parse', 'HEAD'],
    cwd: cloneDir,
    env: extraEnv,
    timeoutMs: 5000,
  });
  if (commitResult.exitCode === 0) {
    commit = commitResult.stdout.trim();
  }

  const workspacePath = resolveWorkspacePath(cloneDir, source.subdir || input.workingDir);

  return {
    mode: input.projectMode ? 'project' : 'entry',
    workspacePath,
    sourceSummary: {
      type: 'git',
      repoUrl: source.repoUrl,
      ref: source.ref,
      subdir: source.subdir,
      commit,
    },
    cleanupPaths,
  };
}

function getRemainingTimeout(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new ScriptPluginError('TIMEOUT', 'execute', 'Global timeout reached before phase execution');
  }
  return remaining;
}

function safeRemove(filePath: string): void {
  try {
    fs.rmSync(filePath, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}

function addPhase(
  phases: PhaseResult[],
  executed: string[],
  skipped: string[],
  phase: PhaseResult
): void {
  phases.push(phase);
  if (phase.skipped) skipped.push(phase.name);
  else executed.push(phase.name);
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

async function executePhase(params: {
  name: PhaseName;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  deadline: number;
  logger: Logger;
  shell?: boolean;
}): Promise<{ phase: PhaseResult; stdout: string; stderr: string }> {
  const started = Date.now();
  params.logger.info(`Phase start: ${params.name}`, { command: params.command, args: params.args || [] });

  const result = await runCommand({
    command: params.command,
    args: params.args || [],
    cwd: params.cwd,
    env: params.env,
    timeoutMs: getRemainingTimeout(params.deadline),
    shell: params.shell,
    onStdoutLine: (line) => {
      params.logger.info(`Phase output [${params.name}] ${shortenLine(line)}`);
    },
    onStderrLine: (line) => {
      params.logger.warn(`Phase stderr [${params.name}] ${shortenLine(line)}`);
    },
  });

  const ended = Date.now();

  const phase: PhaseResult = {
    name: params.name,
    command: params.shell ? params.command : [params.command, ...(params.args || [])].join(' '),
    skipped: false,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    startedAt: toIso(started),
    endedAt: toIso(ended),
  };

  params.logger.info(`Phase end: ${params.name}`, {
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  });

  return { phase, stdout: result.stdout, stderr: result.stderr };
}

export async function executeRun(inputRaw: unknown, context: ExecutionContext): Promise<RunOutput> {
  const input = validateRunInput(inputRaw);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let runtime: RuntimeResolved = input.runtime === 'tsx' ? 'tsx' : 'bun';
  const cleanupPaths: string[] = [];
  const phases: PhaseResult[] = [];
  const executed: string[] = [];
  const skipped: string[] = [];
  let aggregateStdout = '';
  let aggregateStderr = '';

  const startedAt = Date.now();

  try {
    const source = await resolveSource(input, os.tmpdir());
    cleanupPaths.push(...source.cleanupPaths);

    const workspacePath = source.workspacePath;
    const installTool: InstallTool = input.install?.tool ?? 'npm';

    const lockPresent = lockfileExists(workspacePath);
    const installBehavior = resolveInstallBehavior(input.install, lockPresent);

    if (installBehavior.runInstall) {
      const install = input.install as InstallInput;
      const installCmd = buildInstallCommand(install);
      const installRun = await executePhase({
        name: 'install',
        command: installCmd.command,
        args: installCmd.args,
        cwd: workspacePath,
        env: input.env,
        deadline,
        logger: context.log,
        shell: installCmd.shell,
      });
      addPhase(phases, executed, skipped, installRun.phase);
      aggregateStdout += installRun.stdout;
      aggregateStderr += installRun.stderr;

      if (installRun.phase.exitCode !== 0) {
        throw new ScriptPluginError('INSTALL_ERROR', 'install', `Install phase failed with exit code ${installRun.phase.exitCode}`);
      }
    } else {
      addPhase(phases, executed, skipped, {
        name: 'install',
        command: input.install?.command || 'install disabled',
        skipped: true,
      });
    }

    let mainCommand = '';
    let mainArgs: string[] = [];
    let mainCwd = workspacePath;

    if (input.projectMode) {
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new ScriptPluginError('SCRIPT_NOT_FOUND', 'start', `package.json not found in ${workspacePath}`);
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        scripts?: Record<string, string>;
      };

      const plan = planLifecycleScripts(packageJson.scripts, input.lifecycle);

      for (const lifecycle of plan) {
        if (!lifecycle.run) {
          addPhase(phases, executed, skipped, {
            name: lifecycle.name,
            command: `skip ${lifecycle.name}`,
            skipped: true,
          });
          continue;
        }

        const command = buildScriptCommand(installTool, lifecycle.name);
        const phaseRun = await executePhase({
          name: lifecycle.name,
          command: command.command,
          args: command.args,
          cwd: workspacePath,
          env: input.env,
          deadline,
          logger: context.log,
        });
        addPhase(phases, executed, skipped, phaseRun.phase);
        aggregateStdout += phaseRun.stdout;
        aggregateStderr += phaseRun.stderr;

        if (phaseRun.phase.exitCode !== 0) {
          throw new ScriptPluginError('EXECUTION_ERROR', lifecycle.name, `${lifecycle.name} failed with exit code ${phaseRun.phase.exitCode}`);
        }
      }

      const mainScript = buildScriptCommand(installTool, 'start');
      mainCommand = mainScript.command;
      mainArgs = mainScript.args;
    } else {
      runtime = selectRuntime(input.runtime);
      const entryPath = source.mode === 'inline' ? source.entryPath! : path.resolve(workspacePath, input.entry || '');

      if (!fs.existsSync(entryPath)) {
        throw new ScriptPluginError('SOURCE_ERROR', source.mode === 'inline' ? 'inline' : 'entry', `Entry file not found: ${entryPath}`);
      }

      const phaseName: PhaseName = source.mode === 'inline' ? 'inline' : 'entry';

      if (runtime === 'bun') {
        mainCommand = 'bun';
        mainArgs = ['run', entryPath, ...(input.args || [])];
      } else {
        mainCommand = 'tsx';
        mainArgs = [entryPath, ...(input.args || [])];
      }

      const phaseRun = await executePhase({
        name: phaseName,
        command: mainCommand,
        args: mainArgs,
        cwd: workspacePath,
        env: input.env,
        deadline,
        logger: context.log,
      });

      addPhase(phases, executed, skipped, phaseRun.phase);
      aggregateStdout += phaseRun.stdout;
      aggregateStderr += phaseRun.stderr;

      if (phaseRun.phase.exitCode !== 0) {
        throw new ScriptPluginError('EXECUTION_ERROR', phaseName, `${phaseName} failed with exit code ${phaseRun.phase.exitCode}`);
      }

      mainCwd = workspacePath;
    }

    const durationMs = Date.now() - startedAt;
    const stdout = trimOutput(aggregateStdout, MAX_OUTPUT_BYTES);
    const stderr = trimOutput(aggregateStderr, MAX_OUTPUT_BYTES);

    return {
      success: true,
      mode: source.mode,
      source: {
        type: source.sourceSummary.type,
        workspacePath,
        repoUrl: source.sourceSummary.repoUrl,
        ref: source.sourceSummary.ref,
        commit: source.sourceSummary.commit,
        subdir: source.sourceSummary.subdir,
      },
      runtime: {
        selected: runtime,
        installTool: input.install?.enabled ? installTool : 'none',
        projectMode: Boolean(input.projectMode),
      },
      lifecycle: {
        phases,
        executed,
        skipped,
      },
      command: {
        value: mainCommand,
        args: mainArgs,
        workingDir: mainCwd,
        envKeys: Object.keys(input.env || {}),
      },
      exitCode: 0,
      durationMs,
      timedOut: false,
      stdout: stdout.value,
      stderr: stderr.value,
      truncated: {
        stdout: stdout.truncated,
        stderr: stderr.truncated,
        maxBytes: MAX_OUTPUT_BYTES,
      },
    };
  } catch (error) {
    const normalized = normalizeError(error, 'execute');
    context.log.error('Script plugin failed', {
      code: normalized.code,
      phase: normalized.phase,
      message: normalized.message,
      details: normalized.details,
    });

    throw new Error(
      JSON.stringify({
        code: normalized.code,
        phase: normalized.phase,
        message: normalized.message,
        details: normalized.details,
      })
    );
  } finally {
    for (const candidate of cleanupPaths.reverse()) {
      safeRemove(candidate);
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
