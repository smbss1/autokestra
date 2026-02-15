# Plugin SDK Usage

Canonical onboarding guide:

- `docs/plugin-first-plugin.md`

## Creating a Plugin

```typescript
import { defineAction, definePlugin, runPluginProcess } from '@autokestra/plugin-sdk'

const plugin = definePlugin({
  metadata: {
    name: 'http-client',
    version: '0.1.0',
    namespace: 'core',
  },
  actions: {
    run: defineAction({
      async execute(input: { url: string }, context) {
        context.log.info(`Fetching ${input.url}`)
        const response = await fetch(input.url)
        return { data: await response.text() }
      },
    }),
  },
})

if (import.meta.main) {
  runPluginProcess(plugin).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  })
}
```

## Recommended Patterns

- Use inputs for all data, including secrets
- Log via `context.log`
- Handle errors appropriately
- Return structured data