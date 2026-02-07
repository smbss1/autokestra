import { describe, test, expect } from 'bun:test'
import { PluginManager } from './manager'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('PluginManager', () => {
  test('resolves and validates plugin', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-test-'))
    const pluginDir = path.join(tempDir, 'test-plugin')
    fs.mkdirSync(pluginDir)
    const manifestPath = path.join(pluginDir, 'plugin.yaml')
    const manifestContent = `
name: test-plugin
version: 1.0.0
namespace: test
actions:
  - name: test-action
    description: Test action
    input: {}
    output: {}
`
    fs.writeFileSync(manifestPath, manifestContent)

    const manager = new PluginManager({ paths: [tempDir] })
    const plugin = manager.resolvePlugin('test', 'test-plugin')
    expect(plugin).not.toBeNull()
    if (plugin) {
      manager.validatePlugin(plugin)
      const invocation = manager.prepareInvocation(plugin, 'test-action')
      expect(invocation.action.name).toBe('test-action')
    }

    fs.rmSync(tempDir, { recursive: true })
  })
})