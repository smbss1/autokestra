import * as fs from 'fs'
import * as yaml from 'js-yaml'
import Ajv from 'ajv'
import { PluginManifest, pluginManifestSchema } from '@autokestra/plugin-sdk'

const ajv = new Ajv({ allErrors: true })

const validate = ajv.compile(pluginManifestSchema)

export function loadManifest(pluginPath: string): PluginManifest {
  const manifestPath = `${pluginPath.replace(/\/$/, '')}/plugin.yaml`
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`)
  }

  const content = fs.readFileSync(manifestPath, 'utf8')
  let data: any
  try {
    data = yaml.load(content)
  } catch (err) {
    throw new Error(`Invalid YAML in ${manifestPath}: ${err.message}`)
  }

  if (!validate(data)) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ')
    throw new Error(`Invalid manifest in ${manifestPath}: ${errors}`)
  }

  return data as PluginManifest
}