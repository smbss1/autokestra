import { describe, test, expect } from 'bun:test'
import { defineAction } from './sdk'

describe('defineAction', () => {
  test('creates an action handler', () => {
    const handler = defineAction({
      async execute(input, context) {
        return { output: input }
      }
    })

    expect(typeof handler.execute).toBe('function')
  })
})