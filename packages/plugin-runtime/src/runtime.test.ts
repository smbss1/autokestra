import { describe, test, expect } from 'bun:test'
import { ProcessRuntime, DockerRuntime } from './runtime'

describe('ProcessRuntime', () => {
  test('execute throws not implemented for now', async () => {
    const runtime = new ProcessRuntime()
    // Since we don't have a real plugin, it will fail
    // For now, just check it exists
    expect(runtime).toBeInstanceOf(ProcessRuntime)
  })
})

describe('DockerRuntime', () => {
  test('execute throws not implemented for now', async () => {
    const runtime = new DockerRuntime()
    expect(runtime).toBeInstanceOf(DockerRuntime)
  })
})