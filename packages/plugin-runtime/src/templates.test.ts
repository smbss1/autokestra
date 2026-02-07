import { describe, test, expect } from 'bun:test'
import { resolveTemplates } from './templates'

describe('resolveTemplates', () => {
  const context = {
    secrets: { API_KEY: 'secret123' },
    vars: { orgId: 'org456' },
    env: { NODE_ENV: 'test' }
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