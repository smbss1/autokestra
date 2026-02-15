export * from './types'

export interface PluginContext {
  log: Logger
  // secrets via inputs
}

export interface Logger {
  info(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
}

export interface ActionHandler<TInput = any, TOutput = any> {
  execute(input: TInput, context: PluginContext): Promise<TOutput>
}

export interface PluginDefinition {
  metadata: {
    name: string
    version: string
    namespace: string
    description?: string
    author?: string
    license?: string
  }
  actions: Record<string, ActionHandler<any, any>>
}

export interface PluginProcessRequest {
  action: string
  input: unknown
}

export interface ProcessBootstrapOptions {
  io?: {
    readStdin: () => Promise<string>
    writeStdout: (value: string) => void
    writeStderr: (value: string) => void
  }
  contextFactory?: (actionName: string) => PluginContext
}

export function defineAction<TInput = any, TOutput = any>(
  handler: ActionHandler<TInput, TOutput>
) {
  return handler
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  if (!definition || typeof definition !== 'object') {
    throw new Error('Invalid plugin definition: expected object')
  }

  const { metadata, actions } = definition
  if (!metadata?.name || !metadata?.version || !metadata?.namespace) {
    throw new Error('Invalid plugin definition: metadata.name, metadata.version, and metadata.namespace are required')
  }

  if (!actions || typeof actions !== 'object' || Object.keys(actions).length === 0) {
    throw new Error('Invalid plugin definition: at least one action is required')
  }

  return definition
}

export async function runPluginProcess(
  plugin: PluginDefinition,
  options?: ProcessBootstrapOptions
): Promise<void> {
  const io = options?.io ?? {
    readStdin: () => Bun.stdin.text(),
    writeStdout: (value: string) => process.stdout.write(value),
    writeStderr: (value: string) => process.stderr.write(value),
  }

  const request = parsePluginProcessRequest(await io.readStdin())
  const action = plugin.actions[request.action]

  if (!action) {
    throw new Error(`Unsupported action: ${request.action}`)
  }

  const context =
    options?.contextFactory?.(request.action) ??
    ({
      log: createProcessLogger(`[${plugin.metadata.namespace}/${plugin.metadata.name}.${request.action}]`, io.writeStderr),
    } as PluginContext)

  const result = await action.execute(request.input, context)
  io.writeStdout(JSON.stringify(result))
}

export function parsePluginProcessRequest(raw: string): PluginProcessRequest {
  if (!raw || !raw.trim()) {
    throw new Error('Invalid request: expected JSON payload on stdin')
  }

  const parsed = JSON.parse(raw) as Partial<PluginProcessRequest>
  if (!parsed || typeof parsed !== 'object' || typeof parsed.action !== 'string' || parsed.action.trim().length === 0) {
    throw new Error('Invalid request: expected { action: string, input: unknown }')
  }

  return {
    action: parsed.action,
    input: parsed.input,
  }
}

export function createProcessLogger(
  prefix: string,
  writeStderr: (value: string) => void = (value) => process.stderr.write(value)
): Logger {
  const emit = (level: string, message: string, args: any[]) => {
    const payload = {
      timestamp: Date.now(),
      level,
      message: `${prefix} ${formatLog(message, args)}`,
    }
    writeStderr(`${JSON.stringify(payload)}\n`)
  }

  return {
    info: (message: string, ...args: any[]) => emit('INFO', message, args),
    warn: (message: string, ...args: any[]) => emit('WARN', message, args),
    error: (message: string, ...args: any[]) => emit('ERROR', message, args),
    debug: (message: string, ...args: any[]) => emit('DEBUG', message, args),
  }
}

function formatLog(message: string, args: any[]): string {
  if (!args?.length) return message
  const extra = args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')

  return `${message} ${extra}`
}