import { describe, test, expect } from 'bun:test'
import { PluginResolver } from './resolver'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('PluginResolver', () => {
  test('resolves plugin in paths', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-test-'))
    const pluginDir = path.join(tempDir, 'test-plugin')
    fs.mkdirSync(pluginDir)
    const manifestPath = path.join(pluginDir, 'plugin.yaml')
    const manifestContent = `
name: test-plugin
version: 1.0.0
namespace: test
actions: []
`
    fs.writeFileSync(manifestPath, manifestContent)

    const resolver = new PluginResolver({ paths: [tempDir] })
    const plugin = resolver.resolve('test', 'test-plugin')
    expect(plugin).not.toBeNull()
    expect(plugin?.name).toBe('test-plugin')

    fs.rmSync(tempDir, { recursive: true })
  })

  test('returns null for non-existent plugin', () => {
    const resolver = new PluginResolver({ paths: ['/nonexistent'] })
    const plugin = resolver.resolve('test', 'missing')
    expect(plugin).toBeNull()
  })
})