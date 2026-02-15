export const PLUGIN_TEMPLATE_VERSION = 'v1'

function escapeForSingleQuote(value: string): string {
  return value.replace(/'/g, "\\'")
}

export function renderPluginYaml(name: string, namespace: string): string {
  return `namespace: ${namespace}
name: ${name}
version: 0.1.0
description: "${name} plugin"
actions:
  - name: run
    description: "Run ${name} action"
    input:
      type: object
      properties:
        message:
          type: string
      required: [message]
    output:
      type: object
      properties:
        ok:
          type: boolean
        message:
          type: string
`
}

export function renderPackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      scripts: {
        start: 'bun run index.ts',
      },
    },
    null,
    2,
  )
}

export function renderIndexTs(name: string, namespace: string): string {
  const safeName = escapeForSingleQuote(name)
  const safeNamespace = escapeForSingleQuote(namespace)

  return `async function readStdin(): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, metadata?: Record<string, unknown>) {
  process.stderr.write(
    \`\${JSON.stringify({ timestamp: Date.now(), level, message, ...(metadata ? { metadata } : {}) })}\\n\`,
  )
}

async function main() {
  const raw = await readStdin()
  const payload = JSON.parse(raw || '{}') as { action?: string; input?: any }

  if (payload.action !== 'run') {
    throw new Error(\`Unsupported action: \${String(payload.action)}\`)
  }

  const message = typeof payload.input?.message === 'string' ? payload.input.message : 'hello'
  log('INFO', '[${safeNamespace}/${safeName}.run] plugin action executed', { message })

  process.stdout.write(JSON.stringify({ ok: true, message }))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  log('ERROR', '[${safeNamespace}/${safeName}.run] plugin action failed', { message })
  process.exit(1)
})
`
}
