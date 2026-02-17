import { describe, expect, test } from 'bun:test'
import { executeBuild, executeRun } from './core'

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
}

describe('docker plugin validation', () => {
  test('rejects missing image before command execution', async () => {
    await expect(
      executeRun(
        {},
        {
          log: logger,
          securityMode: 'trusted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
        }
      )
    ).rejects.toThrow(/image is required/i)
  })

  test('rejects host volume mappings in MVP', async () => {
    await expect(
      executeRun(
        { image: 'alpine:3.20', volumes: ['/tmp:/tmp'] },
        {
          log: logger,
          securityMode: 'trusted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
        }
      )
    ).rejects.toThrow(/not allowed in MVP/i)
  })

  test('rejects missing build context', async () => {
    await expect(
      executeBuild(
        { tags: ['x:latest'] },
        {
          log: logger,
          securityMode: 'trusted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
        }
      )
    ).rejects.toThrow(/build context is required/i)
  })
})

describe('docker plugin edge cases', () => {
  test('returns timedOut=true when runner reports timeout', async () => {
    const result = await executeRun(
      { image: 'alpine:3.20', timeoutMs: 25 },
      {
        log: logger,
        securityMode: 'trusted',
        runCommand: async (cmd) => {
          if (cmd[0] === 'docker' && cmd[1] === '--version') {
            return { exitCode: 0, stdout: 'Docker version', stderr: '', timedOut: false }
          }
          return { exitCode: 137, stdout: '', stderr: 'killed', timedOut: true }
        },
      }
    )

    expect(result.timedOut).toBe(true)
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(137)
    expect(result.invokedCommand).toContain('docker run --rm alpine:3.20')
  })

  test('denies execution in restricted mode', async () => {
    await expect(
      executeRun(
        { image: 'alpine:3.20' },
        {
          log: logger,
          securityMode: 'restricted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
        }
      )
    ).rejects.toThrow(/not allowed in restricted mode/i)
  })

  test('build command includes tags and build args', async () => {
    const commands: string[][] = []
    const result = await executeBuild(
      {
        context: '.',
        dockerfile: 'Dockerfile',
        tags: ['test:latest', 'test:v1'],
        buildArgs: { NODE_ENV: 'production' },
      },
      {
        log: logger,
        securityMode: 'trusted',
        runCommand: async (cmd) => {
          commands.push(cmd)
          return { exitCode: 0, stdout: 'ok', stderr: '', timedOut: false }
        },
      }
    )

    expect(commands.length).toBe(2)
    expect(commands[1]).toEqual([
      'docker',
      'build',
      '-t',
      'test:latest',
      '-t',
      'test:v1',
      '-f',
      'Dockerfile',
      '--build-arg',
      'NODE_ENV=production',
      '.',
    ])
    expect(result.success).toBe(true)
    expect(result.invokedCommand).toContain('docker build')
  })
})
