export * from './types'
import { safeParse, type BaseSchema } from 'valibot'

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
  description?: string
  inputSchema?: BaseSchema<unknown, TInput, any>
  outputSchema?: BaseSchema<unknown, TOutput, any>
  execute(input: TInput, context: PluginContext): Promise<TOutput>
}

type SchemaOutput<TSchema extends BaseSchema<any, any, any>> =
  TSchema extends BaseSchema<any, infer TOutput, any> ? TOutput : never

export interface SchemaActionHandler<TSchema extends BaseSchema<any, any, any>, TOutput = any>
  extends ActionHandler<SchemaOutput<TSchema>, TOutput> {
  inputSchema: TSchema
}

export interface PluginDefinition {
  metadata: {
    name: string
    version: string
    namespace: string
    description?: string
    author?: string
    license?: string
    runtime?: {
      entrypoint?: string
    }
  }
  actions: Record<string, ActionHandler<any, any>>
}

export interface PluginManifestAction {
  name: string
  description: string
  input: Record<string, unknown>
  output: Record<string, unknown>
}

export interface PluginManifest {
  namespace: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  runtime?: {
    entrypoint?: string
  }
  actions: PluginManifestAction[]
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

export type StreamPassthroughMode = 'prefixed' | 'raw'

export interface StreamCollectionOptions {
  stdout: ReadableStream
  stderr: ReadableStream
  log: Logger
  passthroughMode?: StreamPassthroughMode
  stdoutPrefix?: string
  stderrPrefix?: string
  maxCaptureBytesPerStream?: number
  maxLogLinesPerStream?: number
  maxLogLineChars?: number
}

export interface StreamCollectionResult {
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
}

export function defineAction<TSchema extends BaseSchema<any, any, any>, TOutput = any>(
  handler: SchemaActionHandler<TSchema, TOutput>
): SchemaActionHandler<TSchema, TOutput>
export function defineAction<TInput = any, TOutput = any>(
  handler: ActionHandler<TInput, TOutput>
): ActionHandler<TInput, TOutput>
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

export function pluginToManifest(plugin: PluginDefinition): PluginManifest {
  const actions: PluginManifestAction[] = Object.entries(plugin.actions).map(([actionName, action]) => {
    if (!action.inputSchema) {
      throw new Error(`Cannot generate manifest: action '${actionName}' is missing inputSchema`)
    }
    if (!action.outputSchema) {
      throw new Error(`Cannot generate manifest: action '${actionName}' is missing outputSchema`)
    }

    return {
      name: actionName,
      description: action.description ?? actionName,
      input: schemaToManifestSchema(action.inputSchema),
      output: schemaToManifestSchema(action.outputSchema),
    }
  })

  return {
    namespace: plugin.metadata.namespace,
    name: plugin.metadata.name,
    version: plugin.metadata.version,
    description: plugin.metadata.description,
    author: plugin.metadata.author,
    license: plugin.metadata.license,
    runtime: plugin.metadata.runtime,
    actions,
  }
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

  const parsedInput = parseActionInput(request.action, action, request.input)
  const result = await action.execute(parsedInput, context)
  io.writeStdout(JSON.stringify(result))
}

function parseActionInput<TInput, TOutput>(
  actionName: string,
  action: ActionHandler<TInput, TOutput>,
  input: unknown
): TInput {
  if (!action.inputSchema) {
    return input as TInput
  }

  const parsed = safeParse(action.inputSchema, input)
  if (parsed.success) {
    return parsed.output
  }

  const firstIssue = parsed.issues[0]
  const issuePath = toPathString(firstIssue?.path)
  const message = firstIssue?.message ?? 'Unknown validation error'
  throw new Error(
    `Invalid input for action '${actionName}'${issuePath ? ` at ${issuePath}` : ''}: ${message}`
  )
}

function toPathString(path: any[] | undefined): string {
  if (!path || path.length === 0) return ''

  let result = ''
  for (const segment of path) {
    const key = segment?.key
    if (typeof key === 'number') {
      result += `[${key}]`
    } else if (typeof key === 'string') {
      result += result ? `.${key}` : key
    }
  }
  return result
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

export async function collectPluginStreams(options: StreamCollectionOptions): Promise<StreamCollectionResult> {
  const maxCaptureBytesPerStream = options.maxCaptureBytesPerStream ?? 1024 * 1024
  const maxLogLinesPerStream = options.maxLogLinesPerStream ?? 200
  const maxLogLineChars = options.maxLogLineChars ?? 2000
  const passthroughMode = options.passthroughMode ?? 'prefixed'
  const stdoutPrefix = options.stdoutPrefix ?? '[stdout] '
  const stderrPrefix = options.stderrPrefix ?? '[stderr] '

  const [stdoutResult, stderrResult] = await Promise.all([
    collectSingleStream({
      stream: options.stdout,
      streamName: 'stdout',
      log: options.log,
      level: 'info',
      passthroughMode,
      prefix: stdoutPrefix,
      maxCaptureBytes: maxCaptureBytesPerStream,
      maxLogLines: maxLogLinesPerStream,
      maxLogLineChars,
    }),
    collectSingleStream({
      stream: options.stderr,
      streamName: 'stderr',
      log: options.log,
      level: 'warn',
      passthroughMode,
      prefix: stderrPrefix,
      maxCaptureBytes: maxCaptureBytesPerStream,
      maxLogLines: maxLogLinesPerStream,
      maxLogLineChars,
    }),
  ])

  return {
    stdout: stdoutResult.value,
    stderr: stderrResult.value,
    stdoutTruncated: stdoutResult.truncated,
    stderrTruncated: stderrResult.truncated,
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

type LoggerLevel = 'info' | 'warn'

type SingleStreamResult = {
  value: string
  truncated: boolean
}

async function collectSingleStream(params: {
  stream: ReadableStream
  streamName: 'stdout' | 'stderr'
  log: Logger
  level: LoggerLevel
  passthroughMode: StreamPassthroughMode
  prefix: string
  maxCaptureBytes: number
  maxLogLines: number
  maxLogLineChars: number
}): Promise<SingleStreamResult> {
  const reader = params.stream.getReader()
  const decoder = new TextDecoder()

  const capturedChunks: Uint8Array[] = []
  let capturedBytes = 0
  let outputTruncated = false

  let pending = ''
  let totalLines = 0
  let loggedLines = 0
  let lineLengthTruncated = false

  const logLine = (rawLine: string) => {
    const line = rawLine.trimEnd()
    if (!line.length) return

    totalLines += 1
    if (loggedLines >= params.maxLogLines) {
      return
    }

    const formatted =
      line.length > params.maxLogLineChars
        ? `${line.slice(0, params.maxLogLineChars)}...[TRUNCATED]`
        : line
    if (line.length > params.maxLogLineChars) {
      lineLengthTruncated = true
    }

    const message = params.passthroughMode === 'raw' ? formatted : `${params.prefix}${formatted}`
    if (params.level === 'warn') params.log.warn(message)
    else params.log.info(message)

    loggedLines += 1
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (capturedBytes < params.maxCaptureBytes) {
        const remaining = params.maxCaptureBytes - capturedBytes
        if (value.byteLength <= remaining) {
          capturedChunks.push(value)
          capturedBytes += value.byteLength
        } else {
          capturedChunks.push(value.subarray(0, remaining))
          capturedBytes += remaining
          outputTruncated = true
        }
      } else {
        outputTruncated = true
      }

      pending += decoder.decode(value, { stream: true })
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() || ''
      for (const line of lines) {
        logLine(line)
      }

      const maxPendingLineChars = params.maxLogLineChars * 4
      while (pending.length > maxPendingLineChars) {
        logLine(pending.slice(0, maxPendingLineChars))
        pending = pending.slice(maxPendingLineChars)
        lineLengthTruncated = true
      }
    }

    pending += decoder.decode()
    if (pending.length > 0) {
      logLine(pending)
    }
  } finally {
    reader.releaseLock()
  }

  if (totalLines > loggedLines || lineLengthTruncated || outputTruncated) {
    params.log.warn(`${params.streamName} logs truncated`, {
      totalLines,
      loggedLines,
      lineLengthTruncated,
      outputTruncated,
    })
  }

  return {
    value: Buffer.concat(capturedChunks.map((chunk) => Buffer.from(chunk))).toString('utf8'),
    truncated: outputTruncated,
  }
}

type ManifestSchema = Record<string, unknown>

function schemaToManifestSchema(schema: BaseSchema<any, any, any>): ManifestSchema {
  return toManifestSchemaInternal(schema as any)
}

function toManifestSchemaInternal(schema: any): ManifestSchema {
  const normalized = normalizeSchema(schema)
  if (!normalized || normalized.kind !== 'schema') {
    return { type: 'object' }
  }

  switch (normalized.type) {
    case 'string':
      return { type: 'string' }
    case 'number':
      return { type: 'number' }
    case 'boolean':
      return { type: 'boolean' }
    case 'array':
      return { type: 'array', items: toManifestSchemaInternal(normalized.item) }
    case 'record':
      return { type: 'object', additionalProperties: toManifestSchemaInternal(normalized.value) }
    case 'literal': {
      const literal = normalized.literal
      if (typeof literal === 'string') return { type: 'string', enum: [literal] }
      if (typeof literal === 'number') return { type: 'number', enum: [literal] }
      if (typeof literal === 'boolean') return { type: 'boolean', enum: [literal] }
      return { enum: [literal] }
    }
    case 'union': {
      const options = Array.isArray(normalized.options) ? normalized.options : []
      const literalValues = options
        .map((option: any) => normalizeSchema(option))
        .filter((option: any) => option?.type === 'literal')
        .map((option: any) => option.literal)

      if (literalValues.length === options.length && literalValues.length > 0) {
        const first = literalValues[0]
        const enumType = typeof first
        if (enumType === 'string' || enumType === 'number' || enumType === 'boolean') {
          return { type: enumType, enum: literalValues }
        }
        return { enum: literalValues }
      }

      return {
        anyOf: options.map((option: any) => toManifestSchemaInternal(option)),
      }
    }
    case 'object': {
      const entries = normalized.entries ?? {}
      const properties: Record<string, unknown> = {}
      const required: string[] = []

      for (const [key, rawChild] of Object.entries(entries)) {
        const child = rawChild as any
        properties[key] = toManifestSchemaInternal(child)
        if (!isOptionalSchema(child)) {
          required.push(key)
        }
      }

      const objectSchema: Record<string, unknown> = {
        type: 'object',
        properties,
      }
      if (required.length > 0) {
        objectSchema.required = required
      }

      return objectSchema
    }
    default:
      return { type: inferFallbackType(normalized.expects) }
  }
}

function normalizeSchema(schema: any): any {
  let current = schema

  while (current && current.kind === 'schema') {
    if (Array.isArray(current.pipe)) {
      const firstSchema = current.pipe.find((entry: any) => entry?.kind === 'schema')
      if (firstSchema && firstSchema !== current) {
        current = firstSchema
        continue
      }
    }

    if (current.type === 'optional' || current.type === 'nullable' || current.type === 'nullish') {
      current = current.wrapped
      continue
    }

    break
  }

  return current
}

function isOptionalSchema(schema: any): boolean {
  return schema?.kind === 'schema' && (schema.type === 'optional' || schema.type === 'nullish')
}

function inferFallbackType(expects: unknown): string {
  const raw = typeof expects === 'string' ? expects.toLowerCase() : ''
  if (raw.includes('string')) return 'string'
  if (raw.includes('number')) return 'number'
  if (raw.includes('boolean')) return 'boolean'
  if (raw.includes('array')) return 'array'
  return 'object'
}