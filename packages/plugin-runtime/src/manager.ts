import { PluginResolver, PluginConfig } from './resolver'
import { loadManifest } from './manifest'
import { PluginInfo } from './runtime'

export class PluginManager {
  private resolver: PluginResolver

  constructor(config: PluginConfig) {
    this.resolver = new PluginResolver(config)
  }

  resolvePlugin(namespace: string, pluginName: string): PluginInfo | null {
    return this.resolver.resolve(namespace, pluginName)
  }

  validatePlugin(plugin: PluginInfo): void {
    if (!plugin.manifest.actions || plugin.manifest.actions.length === 0) {
      throw new Error(`Plugin ${plugin.name} has no actions`)
    }
    // Additional validation can be added here
  }

  prepareInvocation(plugin: PluginInfo, actionName: string) {
    const action = plugin.manifest.actions.find(a => a.name === actionName)
    if (!action) {
      throw new Error(`Action ${actionName} not found in plugin ${plugin.name}`)
    }
    return { plugin, action }
  }
}