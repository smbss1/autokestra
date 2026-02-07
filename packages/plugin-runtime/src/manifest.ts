import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import Ajv from 'ajv'
import { PluginManifest } from '@autokestra/plugin-sdk'

const ajv = new Ajv({ allErrors: true })

// Load schema from plugin-sdk
const schemaPath = path.join(__dirname, '../../plugin-sdk/src/manifest.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
const validate = ajv.compile(schema)

export function loadManifest(pluginPath: string): PluginManifest {
  const manifestPath = path.join(pluginPath, 'plugin.yaml')
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