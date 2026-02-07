import { describe, test, expect } from 'bun:test'
import { loadManifest } from './manifest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('loadManifest', () => {
  test('loads valid manifest', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'))
    const manifestPath = path.join(tempDir, 'plugin.yaml')
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

    const manifest = loadManifest(tempDir)
    expect(manifest.name).toBe('test-plugin')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.namespace).toBe('test')
    expect(manifest.actions).toHaveLength(1)

    fs.rmSync(tempDir, { recursive: true })
  })

  test('throws on missing manifest', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'))
    expect(() => loadManifest(tempDir)).toThrow('Manifest not found')
    fs.rmSync(tempDir, { recursive: true })
  })
})