import { defineAction, PluginContext } from '@autokestra/plugin-sdk'

type HttpGetInput = {
  url: string
  headers?: Record<string, string>
  timeoutMs?: number
  response?: 'json' | 'text'
}

type HttpGetOutput = {
  url: string
  status: number
  ok: boolean
  headers: Record<string, string>
  body: unknown
}

function buildRuntimeLogger(taskPrefix?: string) {
  const write = (level: string, message: string, metadata?: Record<string, unknown>) => {
    const payload = {
      timestamp: Date.now(),
      level,
      message: taskPrefix ? `${taskPrefix} ${message}` : message,
      ...(metadata ? { metadata } : {}),
    }
    process.stderr.write(`${JSON.stringify(payload)}\n`)
  }

  return {
    info: (message: string, ...args: any[]) => write('INFO', format(message, args)),
    warn: (message: string, ...args: any[]) => write('WARN', format(message, args)),
    error: (message: string, ...args: any[]) => write('ERROR', format(message, args)),
    debug: (message: string, ...args: any[]) => write('DEBUG', format(message, args)),
  }
}

function format(message: string, args: any[]): string {
  if (!args?.length) return message
  try {
    return `${message} ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
  } catch {
    return message
  }
}

const getAction = defineAction<HttpGetInput, HttpGetOutput>({
  async execute(input: HttpGetInput, context: PluginContext): Promise<HttpGetOutput> {
    const responseMode: 'json' | 'text' = input.response ?? 'json'
    const timeoutMs = input.timeoutMs ?? 30_000

    context.log.info(`HTTP GET ${input.url}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(input.url, {
        method: 'GET',
        headers: input.headers,
        signal: controller.signal,
      })

      const headers: Record<string, string> = {}
      for (const [k, v] of res.headers.entries()) headers[k] = v

      let body: unknown
      if (responseMode === 'text') {
        body = await res.text()
      } else {
        // json mode: try json first, fallback to text
        const text = await res.text()
        try {
          body = text.length ? JSON.parse(text) : null
        } catch {
          body = text
        }
      }

      context.log.info(`HTTP ${res.status} ${res.ok ? 'OK' : 'ERROR'}`)

      return {
        url: input.url,
        status: res.status,
        ok: res.ok,
        headers,
        body,
      }
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : (err?.message ?? String(err))
      context.log.error(`HTTP GET failed: ${msg}`)
      throw new Error(msg)
    } finally {
      clearTimeout(timeout)
    }
  },
})

async function main() {
  const raw = await Bun.stdin.text()
  const req = JSON.parse(raw)

  if (!req || typeof req !== 'object') {
    throw new Error('Invalid input: expected JSON object')
  }

  const { action, input } = req as { action?: string; input?: unknown }
  if (action !== 'get') {
    throw new Error(`Unsupported action: ${String(action)}`)
  }

  const context: PluginContext = {
    log: buildRuntimeLogger('[http.get]'),
  }

  const result = await getAction.execute(input as any, context)
  process.stdout.write(JSON.stringify(result))
}

main().catch(err => {
  process.stderr.write(`${err?.stack ?? err?.message ?? String(err)}\n`)
  process.exit(1)
})
