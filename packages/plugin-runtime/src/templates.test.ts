import { describe, test, expect } from 'bun:test'
import { resolveTemplates } from './templates'

describe('resolveTemplates', () => {
  const context = {
    secrets: { API_KEY: 'secret123' },
    vars: { orgId: 'org456' },
    env: { NODE_ENV: 'test' },
    tasks: { fetch: { output: { status: 200, body: { id: 1 } } } },
  }

  test('resolves secrets template', () => {
    const input = 'Bearer {{ secrets.API_KEY }}'
    const result = resolveTemplates(input, context)
    expect(result).toBe('Bearer secret123')
  })

  test('resolves vars template', () => {
    const input = { org: '{{ vars.orgId }}' }
    const result = resolveTemplates(input, context)
    expect(result).toEqual({ org: 'org456' })
  })

  test('resolves env template', () => {
    const input = 'Running in {{ env.NODE_ENV }}'
    const result = resolveTemplates(input, context)
    expect(result).toBe('Running in test')
  })

  test('throws on unknown template', () => {
    const input = '{{ unknown.KEY }}'
    expect(() => resolveTemplates(input, context)).toThrow('Unknown template')
  })

  test('resolves dotted task output paths inside strings', () => {
    const input = 'status={{ tasks.fetch.output.status }}'
    const result = resolveTemplates(input, context)
    expect(result).toBe('status=200')
  })

  test('returns non-string value when input is exactly one template', () => {
    const input = '{{ tasks.fetch.output }}'
    const result = resolveTemplates(input, context)
    expect(result).toEqual({ status: 200, body: { id: 1 } })
  })

  test('stringifies objects when interpolating into a larger string', () => {
    const input = 'out={{ tasks.fetch.output }}'
    const result = resolveTemplates(input, context)
    expect(result).toBe('out={"status":200,"body":{"id":1}}')
  })

  test('handles nested objects', () => {
    const input = {
      config: {
        url: '{{ secrets.API_KEY }}',
        params: ['{{ vars.orgId }}']
      }
    }
    const result = resolveTemplates(input, context)
    expect(result).toEqual({
      config: {
        url: 'secret123',
        params: ['org456']
      }
    })
  })
})