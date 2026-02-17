import { ScriptPluginError } from '../script/core'
import { collectPluginStreams } from '@autokestra/plugin-sdk'
import * as path from 'node:path'

function now() { return Date.now() }

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

type CommandRunner = (cmd: string[], timeoutMs?: number) => Promise<CommandResult>

type SecurityMode = 'trusted' | 'restricted'

type DockerExecutionContext = {
  log: any
  runCommand?: CommandRunner
  securityMode?: SecurityMode
}

async function runCommand(cmd: string[], timeoutMs?: number, log?: any): Promise<CommandResult> {
  try {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe', env: { ...process.env } })

    let killed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const effectiveTimeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined
    if (effectiveTimeout) {
      timer = setTimeout(() => {
        try { proc.kill() } catch {}
        killed = true
      }, effectiveTimeout)
    }

    const streamCollector = collectPluginStreams({
      stdout: proc.stdout,
      stderr: proc.stderr,
      log: log ?? { info: () => {}, warn: () => {} },
      passthroughMode: 'prefixed',
      stdoutPrefix: '[stdout] ',
      stderrPrefix: '[stderr] ',
    })

    const exitCode = await proc.exited
    const streams = await streamCollector

    if (timer) clearTimeout(timer)
    return { exitCode, stdout: streams.stdout, stderr: streams.stderr, timedOut: killed }
  } catch (err: any) {
    throw new ScriptPluginError('EXECUTION_ERROR', 'exec', String(err))
  }
}

async function ensureDockerAvailable(commandRunner: CommandRunner) {
  const res = await commandRunner(['docker', '--version'], 5000)
  if (res.exitCode !== 0) {
    throw new ScriptPluginError('RUNTIME_NOT_FOUND', 'resolve', 'Docker CLI not available on host')
  }
}

function ensureTrustedMode(mode: SecurityMode) {
  if (mode === 'restricted') {
    throw new ScriptPluginError('EXECUTION_ERROR', 'security', 'Docker plugin actions are not allowed in restricted mode')
  }
}

function resolveSecurityMode(ctx: DockerExecutionContext): SecurityMode {
  if (ctx.securityMode) return ctx.securityMode
  const mode = process.env.AUTOKESTRA_WORKFLOW_SECURITY || 'trusted'
  return mode === 'restricted' ? 'restricted' : 'trusted'
}

export async function executeBuild(input: any, ctx: DockerExecutionContext) {
  ensureTrustedMode(resolveSecurityMode(ctx))

  if (!input || typeof input.context !== 'string' || input.context.trim().length === 0) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'build context is required')
  }

  const commandRunner: CommandRunner = ctx.runCommand ?? ((cmd, timeout) => runCommand(cmd, timeout, ctx.log))
  await ensureDockerAvailable(commandRunner)
  const start = now()

  const args: string[] = ['build']
  if (input.tags && Array.isArray(input.tags)) {
    input.tags.forEach((t: string) => {
      args.push('-t', t)
    })
  }
  if (input.dockerfile) {
    // Ensure Dockerfile path is resolved relative to the build context so that
    // the Docker daemon (running from the host) can locate the file correctly
    // when the plugin process CWD differs from the repo workspace.
    const dockerfilePath = path.isAbsolute(input.dockerfile)
      ? input.dockerfile
      : path.join(input.context, input.dockerfile)
    args.push('-f', dockerfilePath)
  }
  if (input.buildArgs && typeof input.buildArgs === 'object') {
    for (const [k,v] of Object.entries(input.buildArgs)) {
      args.push('--build-arg', `${k}=${v}`)
    }
  }
  args.push(input.context)

  const invoked = ['docker', ...args].join(' ')
  const timeout = typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : undefined
  const res = await commandRunner(['docker', ...args], timeout)
  const duration = now() - start
  return {
    success: res.exitCode === 0,
    exitCode: res.exitCode,
    durationMs: duration,
    timedOut: !!res.timedOut,
    stdout: res.stdout,
    stderr: res.stderr,
    invokedCommand: invoked
  }
}

export async function executeRun(input: any, ctx: DockerExecutionContext) {
  ensureTrustedMode(resolveSecurityMode(ctx))
  if (!input || !input.image) throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'image is required')
  if (input.volumes) throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'host volume mapping is not allowed in MVP')

  const commandRunner: CommandRunner = ctx.runCommand ?? ((cmd, timeout) => runCommand(cmd, timeout, ctx.log))
  await ensureDockerAvailable(commandRunner)

  const start = now()
  const args: string[] = ['run', '--rm']

  if (input.env && typeof input.env === 'object') {
    for (const [k,v] of Object.entries(input.env)) {
      args.push('-e', `${k}=${v}`)
    }
  }

  args.push(input.image)
  if (input.command) {
    args.push(input.command)
  }
  if (input.args && Array.isArray(input.args)) {
    args.push(...input.args)
  }

  const invoked = ['docker', ...args].join(' ')
  const timeout = typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : undefined
  const res = await commandRunner(['docker', ...args], timeout)
  const duration = now() - start
  return {
    success: res.exitCode === 0,
    exitCode: res.exitCode,
    durationMs: duration,
    timedOut: !!res.timedOut,
    stdout: res.stdout,
    stderr: res.stderr,
    invokedCommand: invoked
  }
}
