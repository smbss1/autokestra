import { describe, expect, test } from 'bun:test'
import { composeDown, composeUp, resolveComposeCommand } from './core'

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
}

describe('docker-compose plugin validation', () => {
  test('rejects empty files array for composeUp', async () => {
    await expect(
      composeUp(
        { files: [] },
        {
          log: logger,
          securityMode: 'trusted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
          resolveComposeCommand: async () => ['docker', 'compose'],
        }
      )
    ).rejects.toThrow(/files must be a non-empty array/i)
  })

  test('rejects empty files array for composeDown', async () => {
    await expect(
      composeDown(
        { files: [] },
        {
          log: logger,
          securityMode: 'trusted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
          resolveComposeCommand: async () => ['docker', 'compose'],
        }
      )
    ).rejects.toThrow(/files must be a non-empty array/i)
  })
})

describe('docker-compose fallback and edge cases', () => {
  test('prefers docker compose when available', async () => {
    const runner = async (cmd: string[]) => {
      if (cmd[0] === 'docker' && cmd[1] === 'compose' && cmd[2] === 'version') {
        return { exitCode: 0, stdout: 'Docker Compose', stderr: '', timedOut: false }
      }
      return { exitCode: 1, stdout: '', stderr: '', timedOut: false }
    }

    const resolved = await resolveComposeCommand(runner)
    expect(resolved).toEqual(['docker', 'compose'])
  })

  test('falls back to docker-compose when docker compose is unavailable', async () => {
    const runner = async (cmd: string[]) => {
      if (cmd[0] === 'docker' && cmd[1] === 'compose' && cmd[2] === 'version') {
        return { exitCode: 1, stdout: '', stderr: 'not found', timedOut: false }
      }
      if (cmd[0] === 'docker-compose' && cmd[1] === '--version') {
        return { exitCode: 0, stdout: 'docker-compose version', stderr: '', timedOut: false }
      }
      return { exitCode: 1, stdout: '', stderr: '', timedOut: false }
    }

    const resolved = await resolveComposeCommand(runner)
    expect(resolved).toEqual(['docker-compose'])
  })

  test('returns timedOut=true when compose command times out', async () => {
    const result = await composeUp(
      { files: ['./docker-compose.yml'], detach: true, timeoutMs: 50 },
      {
        log: logger,
        securityMode: 'trusted',
        resolveComposeCommand: async () => ['docker', 'compose'],
        runCommand: async (cmd) => {
          if (cmd[0] === 'docker' && cmd[1] === 'compose' && cmd[2] === 'version') {
            return { exitCode: 0, stdout: 'Docker Compose', stderr: '', timedOut: false }
          }
          return { exitCode: 137, stdout: '', stderr: 'killed', timedOut: true }
        },
      }
    )

    expect(result.timedOut).toBe(true)
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(137)
    expect(result.invokedCommand).toContain('docker compose -f ./docker-compose.yml up -d')
  })

  test('denies execution in restricted mode', async () => {
    await expect(
      composeUp(
        { files: ['./docker-compose.yml'] },
        {
          log: logger,
          securityMode: 'restricted',
          runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
          resolveComposeCommand: async () => ['docker', 'compose'],
        }
      )
    ).rejects.toThrow(/not allowed in restricted mode/i)
  })
})
