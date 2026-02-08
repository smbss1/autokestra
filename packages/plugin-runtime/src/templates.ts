export interface TemplateContext {
  secrets: Record<string, string>
  vars: Record<string, any>
  env: Record<string, string>
  tasks?: Record<string, any>
}

function getByPath(root: any, pathParts: string[]): any {
  let cur = root
  for (const part of pathParts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = (cur as any)[part]
      continue
    }
    return undefined
  }
  return cur
}

function stringifyForInterpolation(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function resolveTemplates(input: any, context: TemplateContext): any {
  if (typeof input === 'string') {
    // If the whole string is a single template, return the underlying value (can be non-string).
    const whole = input.match(/^\{\{\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\s*\}\}$/)
    if (whole) {
      const expr = whole[1]
      const [rootKey, ...rest] = expr.split('.')
      const root = (context as any)[rootKey]
      const resolved = getByPath(root, rest)
      if (resolved === undefined) {
        throw new Error(`Unknown template: ${input}`)
      }
      return resolved
    }

    // Interpolate one or more templates inside a larger string.
    return input.replace(/\{\{\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\s*\}\}/g, (match, expr) => {
      const [rootKey, ...rest] = String(expr).split('.')
      const root = (context as any)[rootKey]
      const resolved = getByPath(root, rest)
      if (resolved === undefined) {
        throw new Error(`Unknown template: ${match}`)
      }
      return stringifyForInterpolation(resolved)
    })
  } else if (Array.isArray(input)) {
    return input.map(item => resolveTemplates(item, context))
  } else if (input && typeof input === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(input)) {
      result[key] = resolveTemplates(value, context)
    }
    return result
  }
  return input
}