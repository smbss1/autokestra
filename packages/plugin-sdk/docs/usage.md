# Plugin SDK Usage

Canonical onboarding guide:

- `docs/plugin-first-plugin.md`

## Creating a Plugin

```typescript
import { defineAction, definePlugin, runPluginProcess } from '@autokestra/plugin-sdk'
import { object, pipe, string, minLength, optional, number } from 'valibot'

const plugin = definePlugin({
  metadata: {
    name: 'http-client',
    version: '0.1.0',
    namespace: 'core',
  },
  actions: {
    run: defineAction({
      inputSchema: object({
        url: pipe(string(), minLength(1)),
        timeoutMs: optional(number()),
      }),
      async execute(input, context) {
        context.log.info(`Fetching ${input.url}`)
        const response = await fetch(input.url, { signal: AbortSignal.timeout(input.timeoutMs ?? 30_000) })
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

`defineAction` accepts an optional Valibot `inputSchema`.
When provided, `runPluginProcess` validates/parses `request.input` with Valibot before calling `execute`, and `execute` receives only the validated output shape.

## Recommended Patterns

- Use inputs for all data, including secrets
- Log via `context.log`
- Handle errors appropriately
- Return structured data