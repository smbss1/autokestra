import { describe, expect, it } from 'bun:test'
import { PLUGIN_TEMPLATE_VERSION, renderIndexTs, renderPackageJson, renderPluginYaml } from './pluginTemplates'

describe('plugin templates', () => {
  it('uses versioned template identifier', () => {
    expect(PLUGIN_TEMPLATE_VERSION).toBe('v1')
  })

  it('renders plugin.yaml golden output', () => {
    const rendered = renderPluginYaml('sample-plugin', 'community')
    expect(rendered).toContain('namespace: community')
    expect(rendered).toContain('name: sample-plugin')
    expect(rendered).toContain('actions:')
    expect(rendered).toContain('- name: run')
  })

  it('renders index.ts golden output', () => {
    const rendered = renderIndexTs('sample-plugin', 'community')
    expect(rendered).toContain("if (payload.action !== 'run')")
    expect(rendered).toContain('[community/sample-plugin.run] plugin action executed')
    expect(rendered).toContain('process.stdout.write(JSON.stringify({ ok: true, message }))')
  })

  it('renders package.json golden output', () => {
    const rendered = JSON.parse(renderPackageJson('sample-plugin'))
    expect(rendered.name).toBe('sample-plugin')
    expect(rendered.scripts.start).toBe('bun run index.ts')
  })
})
