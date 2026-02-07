import { PluginManifest, ActionDef } from '@autokestra/plugin-sdk'

export interface PluginRuntime {
  execute(plugin: PluginInfo, input: unknown, timeoutMs?: number): Promise<unknown>
}

export interface PluginInfo {
  name: string
  path: string
  manifest: PluginManifest
}

export class ProcessRuntime implements PluginRuntime {
  async execute(plugin: PluginInfo, input: unknown, timeoutMs = 30000): Promise<unknown> {
    const action = plugin.manifest.actions[0] // Assume first action for now
    const entryPoint = `${plugin.path}/index.ts` // Assume index.ts

    const proc = Bun.spawn(['bun', 'run', entryPoint], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env }
    })

    const inputJson = JSON.stringify({ action: action.name, input })
    proc.stdin.write(inputJson)
    proc.stdin.end()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill()
        reject(new Error('Plugin execution timed out'))
      }, timeoutMs)
    })

    const executionPromise = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]).then(async ([output, errorOutput, exitCode]) => {
      if (exitCode !== 0) {
        throw new Error(`Plugin execution failed: ${errorOutput}`)
      }
      try {
        return JSON.parse(output.trim())
      } catch (err) {
        throw new Error(`Invalid plugin output: ${output}`)
      }
    })

    return Promise.race([executionPromise, timeoutPromise])
  }
}

export class DockerRuntime implements PluginRuntime {
  async execute(plugin: PluginInfo, input: unknown, timeoutMs = 30000): Promise<unknown> {
    const action = plugin.manifest.actions[0] // Assume first action
    const imageName = `${plugin.name}:latest` // Assume built image

    const dockerArgs = [
      'run',
      '--rm',
      '--network=none',
      '-i', // interactive
      imageName
    ]

    const proc = Bun.spawn(['docker', ...dockerArgs], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    })

    const inputJson = JSON.stringify({ action: action.name, input })
    proc.stdin.write(inputJson)
    proc.stdin.end()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill()
        reject(new Error('Docker execution timed out'))
      }, timeoutMs)
    })

    const executionPromise = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]).then(async ([output, errorOutput, exitCode]) => {
      if (exitCode !== 0) {
        throw new Error(`Docker execution failed: ${errorOutput}`)
      }
      try {
        return JSON.parse(output.trim())
      } catch (err) {
        throw new Error(`Invalid plugin output: ${output}`)
      }
    })

    return Promise.race([executionPromise, timeoutPromise])
  }
}