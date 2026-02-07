export interface PluginManifest {
  name: string
  version: string
  namespace: string
  description?: string
  author?: string
  license?: string
  actions: ActionDef[]
  capabilities?: string[]
}

export interface ActionDef {
  name: string
  description: string
  input: any // JSON Schema
  output: any // JSON Schema
}

export type Capabilities = string[]