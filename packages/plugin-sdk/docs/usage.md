# Plugin SDK Usage

## Creating a Plugin

```typescript
import { defineAction } from '@autokestra/plugin-sdk'

export default defineAction({
  async execute(input: { url: string }, context) {
    context.log.info(`Fetching ${input.url}`)
    // Secrets are passed via inputs, not environment
    const response = await fetch(input.url)
    return { data: await response.text() }
  }
})
```

## Recommended Patterns

- Use inputs for all data, including secrets
- Log via `context.log`
- Handle errors appropriately
- Return structured data