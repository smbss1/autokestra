import { defineAction, definePlugin, runPluginProcess } from '@autokestra/plugin-sdk'
import { object, array, string, optional, boolean, number } from 'valibot'
import { composeUp, composeDown } from './core'

const upInput = object({ files: array(string()), projectName: optional(string()), detach: optional(boolean()), timeoutMs: optional(number()) })
const downInput = object({ files: array(string()), projectName: optional(string()), timeoutMs: optional(number()) })

const commonOutput = object({
  success: boolean(),
  exitCode: number(),
  durationMs: number(),
  timedOut: boolean(),
  stdout: string(),
  stderr: string(),
  invokedCommand: optional(string())
})

const upAction = defineAction({
  description: 'Compose up',
  inputSchema: upInput,
  outputSchema: commonOutput,
  async execute(input: any, context: any) {
    return await composeUp(input, { log: context.log })
  }
})

const downAction = defineAction({
  description: 'Compose down',
  inputSchema: downInput,
  outputSchema: commonOutput,
  async execute(input: any, context: any) {
    return await composeDown(input, { log: context.log })
  }
})

export const plugin = definePlugin({
  metadata: {
    namespace: 'core',
    name: 'docker-compose',
    version: '0.1.0',
    description: 'Docker Compose plugin (up/down) - trusted mode only'
  },
  actions: {
    up: upAction,
    down: downAction
  }
})

if (import.meta.main) {
  runPluginProcess(plugin).catch((err: any) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  })
}
