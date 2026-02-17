import { defineAction, definePlugin, runPluginProcess } from '@autokestra/plugin-sdk'
import { object, string, array, record, number, optional, boolean } from 'valibot'
import { executeBuild, executeRun } from './core'

const buildInput = object({
  context: string(),
  dockerfile: optional(string()),
  tags: optional(array(string())),
  buildArgs: optional(record(string(), string()))
})

const buildOutput = object({
  success: boolean(),
  exitCode: number(),
  durationMs: number(),
  timedOut: boolean(),
  stdout: string(),
  stderr: string(),
  invokedCommand: optional(string())
})

const runInput = object({
  image: string(),
  command: optional(string()),
  args: optional(array(string())),
  env: optional(record(string(), string())),
  timeoutMs: optional(number())
})

const runOutput = object({
  success: boolean(),
  exitCode: number(),
  durationMs: number(),
  timedOut: boolean(),
  stdout: string(),
  stderr: string(),
  invokedCommand: optional(string())
})

const runAction = defineAction({
  description: 'Run a Docker container (MVP, no host volume mapping)',
  inputSchema: runInput,
  outputSchema: runOutput,
  async execute(input: any, context: any) {
    return await executeRun(input, { log: context.log })
  }
})

const buildAction = defineAction({
  description: 'Build a Docker image from context',
  inputSchema: buildInput,
  outputSchema: buildOutput,
  async execute(input: any, context: any) {
    return await executeBuild(input, { log: context.log })
  }
})

export const plugin = definePlugin({
  metadata: {
    namespace: 'core',
    name: 'docker',
    version: '0.1.0',
    description: 'Docker plugin (build/run) - trusted mode only'
  },
  actions: {
    build: buildAction,
    run: runAction
  }
})

if (import.meta.main) {
  runPluginProcess(plugin).catch((err: any) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  })
}
