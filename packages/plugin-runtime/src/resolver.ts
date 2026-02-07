import * as fs from 'fs'
import * as path from 'path'
import { loadManifest } from './manifest'
import { PluginInfo } from './runtime'

export interface PluginConfig {
  paths: string[]
}

export class PluginResolver {
  constructor(private config: PluginConfig) {}

  resolve(namespace: string, pluginName: string): PluginInfo | null {
    for (const basePath of this.config.paths) {
      const pluginPath = path.join(basePath, pluginName)
      if (fs.existsSync(pluginPath) && fs.statSync(pluginPath).isDirectory()) {
        try {
          const manifest = loadManifest(pluginPath)
          if (manifest.namespace === namespace) {
            return {
              name: pluginName,
              path: pluginPath,
              manifest
            }
          }
        } catch (err) {
          // Skip invalid plugins
          continue
        }
      }
    }
    return null
  }
}