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

  test('loads manifest with declared runtime entrypoint', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'))
    const manifestPath = path.join(tempDir, 'plugin.yaml')
    const manifestContent = `
name: test-plugin
version: 1.0.0
namespace: test
runtime:
  entrypoint: dist/index.js
actions:
  - name: test-action
    description: Test action
    input: {}
    output: {}
`
    fs.writeFileSync(manifestPath, manifestContent)

    const manifest = loadManifest(tempDir)
    expect(manifest.runtime?.entrypoint).toBe('dist/index.js')

    fs.rmSync(tempDir, { recursive: true })
  })

  test('throws on invalid absolute runtime entrypoint', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'))
    const manifestPath = path.join(tempDir, 'plugin.yaml')
    const manifestContent = `
name: test-plugin
version: 1.0.0
namespace: test
runtime:
  entrypoint: /abs/index.js
actions:
  - name: test-action
    description: Test action
    input: {}
    output: {}
`
    fs.writeFileSync(manifestPath, manifestContent)

    expect(() => loadManifest(tempDir)).toThrow('absolute paths are not allowed')
    fs.rmSync(tempDir, { recursive: true })
  })

  test('throws on empty runtime entrypoint', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'))
    const manifestPath = path.join(tempDir, 'plugin.yaml')
    const manifestContent = `
name: test-plugin
version: 1.0.0
namespace: test
runtime:
  entrypoint: ''
actions:
  - name: test-action
    description: Test action
    input: {}
    output: {}
`
    fs.writeFileSync(manifestPath, manifestContent)

    expect(() => loadManifest(tempDir)).toThrow('value must be a non-empty relative path')
    fs.rmSync(tempDir, { recursive: true })
  })
})