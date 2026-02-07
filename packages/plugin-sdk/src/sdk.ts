export * from './types'

export interface PluginContext {
  log: Logger
  // secrets via inputs
}

export interface Logger {
  info(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
}

export interface ActionHandler<TInput = any, TOutput = any> {
  execute(input: TInput, context: PluginContext): Promise<TOutput>
}

export function defineAction<TInput = any, TOutput = any>(
  handler: ActionHandler<TInput, TOutput>
) {
  return handler
}