import { PluginManager } from './manager'
import { PluginRuntime } from './runtime'
import { resolveTemplates, TemplateContext } from './templates'
import { WorkflowPermissions } from './permissions'

export interface ExecutionMetrics {
  duration: number
  exitCode?: number
  memoryUsage?: number
}

export class PluginExecutor {
  constructor(
    private manager: PluginManager,
    private runtime: PluginRuntime,
    private permissions: WorkflowPermissions
  ) {}

  async execute(
    namespace: string,
    pluginName: string,
    actionName: string,
    inputs: any,
    templateContext: TemplateContext,
    timeoutMs?: number
  ): Promise<{ result: any; metrics: ExecutionMetrics }> {
    const plugin = this.manager.resolvePlugin(namespace, pluginName)
    if (!plugin) {
      throw new Error(`Plugin ${namespace}/${pluginName} not found`)
    }

    this.manager.validatePlugin(plugin)
    const invocation = this.manager.prepareInvocation(plugin, actionName)

    const resolvedInputs = resolveTemplates(inputs, templateContext)

    const startTime = Date.now()
    try {
      const result = await this.runtime.execute(plugin, resolvedInputs, timeoutMs)
      const duration = Date.now() - startTime
      return {
        result,
        metrics: {
          duration,
          exitCode: 0 // Assume success
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw {
        error,
        metrics: {
          duration,
          exitCode: 1 // Assume failure
        }
      }
    }
  }
}