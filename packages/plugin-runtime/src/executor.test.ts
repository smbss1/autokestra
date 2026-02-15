import { describe, test, expect } from 'bun:test'
import { PluginExecutor } from './executor'
import { PluginManager } from './manager'
import { ProcessRuntime } from './runtime'
import { WorkflowPermissions } from './permissions'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('PluginExecutor', () => {
  test('executor can be created', () => {
    const manager = new PluginManager({ paths: [] })
    const runtime = new ProcessRuntime()
    const permissions: WorkflowPermissions = { security: 'trusted' }
    const executor = new PluginExecutor(manager, runtime, permissions)
    expect(executor).toBeInstanceOf(PluginExecutor)
  })

  test('dispatches the requested action from task type', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-plugin-executor-'))
    const pluginDir = join(dir, 'multi-action')
    mkdirSync(pluginDir, { recursive: true })

    const manifest = `namespace: test
name: multi-action
version: 0.0.1
actions:
  - name: start
    description: start action
    input:
      type: object
    output:
      type: object
  - name: stop
    description: stop action
    input:
      type: object
    output:
      type: object
`

    writeFileSync(join(pluginDir, 'plugin.yaml'), manifest, 'utf8')
    writeFileSync(
      join(pluginDir, 'index.ts'),
      `const raw = await Bun.stdin.text();
const payload = JSON.parse(raw);
process.stdout.write(JSON.stringify({ action: payload.action, ok: true }));
`,
      'utf8',
    )

    try {
      const manager = new PluginManager({ paths: [dir] })
      const runtime = new ProcessRuntime()
      const permissions: WorkflowPermissions = { security: 'trusted' }
      const executor = new PluginExecutor(manager, runtime, permissions)

      const result = await executor.execute(
        'test',
        'multi-action',
        'stop',
        { value: 1 },
        { secrets: {}, vars: {}, env: {} },
      )

      expect(result.result.action).toBe('stop')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('uses declared runtime entrypoint when provided', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-plugin-executor-'))
    const pluginDir = join(dir, 'declared-entry')
    mkdirSync(join(pluginDir, 'dist'), { recursive: true })

    const manifest = `namespace: test
name: declared-entry
version: 0.0.1
runtime:
  entrypoint: dist/index.js
actions:
  - name: run
    description: run action
    input:
      type: object
    output:
      type: object
`

    writeFileSync(join(pluginDir, 'plugin.yaml'), manifest, 'utf8')
    writeFileSync(
      join(pluginDir, 'dist', 'index.js'),
      `const raw = await Bun.stdin.text();
const payload = JSON.parse(raw);
process.stdout.write(JSON.stringify({ action: payload.action, from: 'declared-entrypoint' }));
`,
      'utf8',
    )

    try {
      const manager = new PluginManager({ paths: [dir] })
      const runtime = new ProcessRuntime()
      const permissions: WorkflowPermissions = { security: 'trusted' }
      const executor = new PluginExecutor(manager, runtime, permissions)

      const result = await executor.execute(
        'test',
        'declared-entry',
        'run',
        {},
        { secrets: {}, vars: {}, env: {} },
      )

      expect(result.result.action).toBe('run')
      expect(result.result.from).toBe('declared-entrypoint')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})