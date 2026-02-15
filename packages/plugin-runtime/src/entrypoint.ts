import { PluginManifest } from '@autokestra/plugin-sdk'
import * as path from 'node:path'
import * as fs from 'node:fs'

const LEGACY_ENTRYPOINT = 'index.ts'

export function validateRuntimeEntrypoint(entrypoint: string): void {
  const trimmed = String(entrypoint || '').trim()
  if (!trimmed) {
    throw new Error('Invalid manifest runtime.entrypoint: value must be a non-empty relative path')
  }

  if (path.isAbsolute(trimmed)) {
    throw new Error('Invalid manifest runtime.entrypoint: absolute paths are not allowed')
  }

  const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'))
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('Invalid manifest runtime.entrypoint: path traversal is not allowed')
  }
}

export function getDeclaredEntrypoint(manifest: PluginManifest): string | undefined {
  const entrypoint = manifest.runtime?.entrypoint
  if (entrypoint === undefined) {
    return undefined
  }

  validateRuntimeEntrypoint(entrypoint)
  return entrypoint
}

export function resolvePluginEntrypoint(pluginPath: string, manifest: PluginManifest): string {
  const declared = getDeclaredEntrypoint(manifest)

  if (declared) {
    const declaredPath = path.resolve(pluginPath, declared)
    if (!fs.existsSync(declaredPath)) {
      throw new Error(`Plugin entrypoint not found: ${declaredPath}`)
    }
    return declaredPath
  }

  const fallback = path.resolve(pluginPath, LEGACY_ENTRYPOINT)
  if (!fs.existsSync(fallback)) {
    throw new Error(`Plugin entrypoint not found: ${fallback}`)
  }

  return fallback
}
