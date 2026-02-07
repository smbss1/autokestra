import { describe, test, expect } from 'bun:test'
import { PluginExecutor } from './executor'
import { PluginManager } from './manager'
import { ProcessRuntime } from './runtime'
import { WorkflowPermissions } from './permissions'

describe('PluginExecutor', () => {
  test('executor can be created', () => {
    const manager = new PluginManager({ paths: [] })
    const runtime = new ProcessRuntime()
    const permissions: WorkflowPermissions = { security: 'trusted' }
    const executor = new PluginExecutor(manager, runtime, permissions)
    expect(executor).toBeInstanceOf(PluginExecutor)
  })
})