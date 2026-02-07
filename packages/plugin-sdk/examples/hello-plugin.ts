// Example HTTP plugin using the SDK

import { defineAction } from '../src/sdk'

export default defineAction({
  async execute(input: { url: string }, context) {
    context.log.info(`Fetching ${input.url}`)
    const response = await fetch(input.url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.text()
    return { data, status: response.status }
  }
})