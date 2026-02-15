import { describe, test, expect } from 'bun:test'
import { collectPluginStreams, createProcessLogger, defineAction, definePlugin, pluginToManifest, runPluginProcess } from './sdk'
import { array, boolean, literal, number, object, optional, pipe, record, string, minLength } from 'valibot'

describe('defineAction', () => {
  test('creates an action handler', () => {
    const handler = defineAction({
      async execute(input, context) {
        return { output: input }
      }
    })

    expect(typeof handler.execute).toBe('function')
  })

  test('supports valibot schema and exposes typed validated input', async () => {
    const handler = defineAction({
      inputSchema: object({
        value: pipe(string(), minLength(1)),
      }),
      async execute(input) {
        return { value: input.value }
      },
    })

    const result = await handler.execute({ value: 'ok' }, { log: createProcessLogger('[test]') })
    expect(result).toEqual({ value: 'ok' })
  })
})

describe('definePlugin', () => {
  test('creates plugin definition with actions', () => {
    const plugin = definePlugin({
      metadata: {
        name: 'hello-plugin',
        version: '0.0.1',
        namespace: 'test',
      },
      actions: {
        run: defineAction({
          async execute(input: { name: string }) {
            return { ok: true, name: input.name }
          },
        }),
      },
    })

    expect(plugin.metadata.name).toBe('hello-plugin')
    expect(typeof plugin.actions.run.execute).toBe('function')
  })

  test('converts definePlugin output to plugin manifest using valibot schemas', () => {
    const plugin = definePlugin({
      metadata: {
        name: 'hello-plugin',
        version: '0.0.1',
        namespace: 'core',
        description: 'hello plugin',
      },
      actions: {
        run: defineAction({
          description: 'run action',
          inputSchema: object({
            command: string(),
            shell: optional(literal('bash')),
          }),
          outputSchema: object({
            success: boolean(),
            lines: array(string()),
            code: number(),
            env: optional(record(string(), string())),
          }),
          async execute(input) {
            return {
              success: true,
              lines: [input.command],
              code: 0,
            }
          },
        }),
      },
    })

    const manifest = pluginToManifest(plugin)
    expect(manifest.namespace).toBe('core')
    expect(manifest.name).toBe('hello-plugin')
    expect(manifest.actions).toHaveLength(1)
    expect(manifest.actions[0].name).toBe('run')
    expect(manifest.actions[0].description).toBe('run action')
    expect(manifest.actions[0].input).toEqual({
      type: 'object',
      properties: {
        command: { type: 'string' },
        shell: { type: 'string', enum: ['bash'] },
      },
      required: ['command'],
    })
    expect(manifest.actions[0].output).toEqual({
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        lines: { type: 'array', items: { type: 'string' } },
        code: { type: 'number' },
        env: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['success', 'lines', 'code'],
    })
  })
})

describe('runPluginProcess', () => {
  test('dispatches action and writes JSON result to stdout', async () => {
    let stdout = ''
    const stderr: string[] = []

    const plugin = definePlugin({
      metadata: {
        name: 'example',
        version: '0.0.1',
        namespace: 'test',
      },
      actions: {
        echo: defineAction({
          async execute(input: { value: string }, context) {
            context.log.info('processing', input.value)
            return { value: input.value }
          },
        }),
      },
    })

    await runPluginProcess(plugin, {
      io: {
        readStdin: async () => JSON.stringify({ action: 'echo', input: { value: 'hello' } }),
        writeStdout: (value: string) => {
          stdout += value
        },
        writeStderr: (value: string) => {
          stderr.push(value)
        },
      },
    })

    expect(JSON.parse(stdout)).toEqual({ value: 'hello' })
    expect(stderr.length).toBeGreaterThan(0)
    expect(stderr.join('')).toContain('processing')
  })

  test('throws for unknown action', async () => {
    const plugin = definePlugin({
      metadata: {
        name: 'example',
        version: '0.0.1',
        namespace: 'test',
      },
      actions: {
        ping: defineAction({
          async execute() {
            return { ok: true }
          },
        }),
      },
    })

    await expect(
      runPluginProcess(plugin, {
        io: {
          readStdin: async () => JSON.stringify({ action: 'missing', input: {} }),
          writeStdout: () => {},
          writeStderr: () => {},
        },
      })
    ).rejects.toThrow('Unsupported action: missing')
  })

  test('validates action input using valibot schema before execute', async () => {
    const plugin = definePlugin({
      metadata: {
        name: 'example',
        version: '0.0.1',
        namespace: 'test',
      },
      actions: {
        echo: defineAction({
          inputSchema: object({
            value: pipe(string(), minLength(1)),
          }),
          async execute(input: { value: string }) {
            return { value: input.value }
          },
        }),
      },
    })

    await expect(
      runPluginProcess(plugin, {
        io: {
          readStdin: async () => JSON.stringify({ action: 'echo', input: { value: '' } }),
          writeStdout: () => {},
          writeStderr: () => {},
        },
      })
    ).rejects.toThrow("Invalid input for action 'echo' at value")
  })
})

describe('createProcessLogger', () => {
  test('writes structured JSON logs to stderr sink', () => {
    const lines: string[] = []
    const logger = createProcessLogger('[test/logger]', (line) => lines.push(line))

    logger.info('hello', { id: 1 })

    expect(lines.length).toBe(1)
    const parsed = JSON.parse(lines[0].trim())
    expect(parsed.level).toBe('INFO')
    expect(parsed.message).toContain('[test/logger] hello')
  })
})

describe('collectPluginStreams', () => {
  test('captures streams and logs with prefixed mode by default', async () => {
    const logs: string[] = []
    const log = {
      info: (message: string) => logs.push(`INFO:${message}`),
      warn: (message: string) => logs.push(`WARN:${message}`),
      error: () => undefined,
      debug: () => undefined,
    }

    const result = await collectPluginStreams({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('hello\\n'))
          controller.close()
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('warn-line\\n'))
          controller.close()
        },
      }),
      log,
    })

    expect(result.stdout).toContain('hello')
    expect(result.stderr).toContain('warn-line')
    expect(logs.some((entry) => entry.includes('INFO:[stdout] hello'))).toBe(true)
    expect(logs.some((entry) => entry.includes('WARN:[stderr] warn-line'))).toBe(true)
  })
})