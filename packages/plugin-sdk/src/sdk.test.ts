import { describe, test, expect } from 'bun:test'
import { createProcessLogger, defineAction, definePlugin, runPluginProcess } from './sdk'
import { object, pipe, string, minLength } from 'valibot'

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