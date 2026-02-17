import { ScriptPluginError } from '../script/core'

function now() { return Date.now() }

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

type CommandRunner = (cmd: string[], timeoutMs?: number) => Promise<CommandResult>
type ComposeCommand = string[]
type SecurityMode = 'trusted' | 'restricted'

type ComposeExecutionContext = {
  log: any
  runCommand?: CommandRunner
  resolveComposeCommand?: (commandRunner: CommandRunner) => Promise<ComposeCommand>
  securityMode?: SecurityMode
}

async function runCommand(cmd: string[], timeoutMs?: number): Promise<CommandResult> {
  try {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe', env: { ...process.env } })

    let killed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      timer = setTimeout(() => {
        try { proc.kill() } catch {}
        killed = true
      }, timeoutMs)
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ])

    if (timer) clearTimeout(timer)
    return { exitCode, stdout, stderr, timedOut: killed }
  } catch (err: any) {
    throw new ScriptPluginError('EXECUTION_ERROR', 'exec', String(err))
  }
}

export async function resolveComposeCommand(commandRunner: CommandRunner): Promise<ComposeCommand> {
  // Try `docker compose` first
  try {
    const tryDockerCompose = await commandRunner(['docker', 'compose', 'version'], 5000)
    if (tryDockerCompose.exitCode === 0) return ['docker', 'compose']
  } catch {}

  try {
    const tryLegacy = await commandRunner(['docker-compose', '--version'], 5000)
    if (tryLegacy.exitCode === 0) return ['docker-compose']
  } catch {}

  throw new ScriptPluginError('RUNTIME_NOT_FOUND', 'resolve', 'Compose support not available (docker compose or docker-compose required)')
}

function ensureTrustedMode(mode: SecurityMode) {
  if (mode === 'restricted') {
    throw new ScriptPluginError('EXECUTION_ERROR', 'security', 'Docker Compose plugin actions are not allowed in restricted mode')
  }
}

function resolveSecurityMode(ctx: ComposeExecutionContext): SecurityMode {
  if (ctx.securityMode) return ctx.securityMode
  const mode = process.env.AUTOKESTRA_WORKFLOW_SECURITY || 'trusted'
  return mode === 'restricted' ? 'restricted' : 'trusted'
}

export async function composeUp(input: any, ctx: ComposeExecutionContext) {
  ensureTrustedMode(resolveSecurityMode(ctx))
  if (!input.files || !Array.isArray(input.files) || input.files.length === 0) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'files must be a non-empty array')
  }

  const commandRunner = ctx.runCommand ?? runCommand
  const composeResolver = ctx.resolveComposeCommand ?? resolveComposeCommand
  const cmdBase = await composeResolver(commandRunner)
  const start = now()

  const args: string[] = []
  for (const f of input.files) {
    args.push('-f', f)
  }
  if (input.projectName) {
    args.push('-p', input.projectName)
  }
  args.push('up')
  if (input.detach) args.push('-d')

  const invoked = [...cmdBase, ...args].join(' ')
  const timeout = typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : undefined
  const res = await commandRunner([...cmdBase, ...args], timeout)
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

export async function composeDown(input: any, ctx: ComposeExecutionContext) {
  ensureTrustedMode(resolveSecurityMode(ctx))
  if (!input.files || !Array.isArray(input.files) || input.files.length === 0) {
    throw new ScriptPluginError('VALIDATION_ERROR', 'resolve', 'files must be a non-empty array')
  }

  const commandRunner = ctx.runCommand ?? runCommand
  const composeResolver = ctx.resolveComposeCommand ?? resolveComposeCommand
  const cmdBase = await composeResolver(commandRunner)
  const start = now()

  const args: string[] = []
  for (const f of input.files) {
    args.push('-f', f)
  }
  if (input.projectName) {
    args.push('-p', input.projectName)
  }
  args.push('down')

  const invoked = [...cmdBase, ...args].join(' ')
  const timeout = typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : undefined
  const res = await commandRunner([...cmdBase, ...args], timeout)
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
