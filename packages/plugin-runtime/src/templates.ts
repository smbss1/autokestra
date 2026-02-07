export interface TemplateContext {
  secrets: Record<string, string>
  vars: Record<string, any>
  env: Record<string, string>
  tasks?: Record<string, any>
}

export function resolveTemplates(input: any, context: TemplateContext): any {
  if (typeof input === 'string') {
    return input.replace(/\{\{\s*(\w+)\.(\w+)\s*\}\}/g, (match, namespace, key) => {
      const ns = context[namespace as keyof TemplateContext]
      if (ns && typeof ns === 'object' && key in ns) {
        return ns[key]
      }
      throw new Error(`Unknown template: ${match}`)
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