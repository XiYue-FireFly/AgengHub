/**
 * Plugin Manager: safe plugin manifest management.
 *
 * Plugins contribute metadata (commands, skills, prompts) but cannot
 * inject arbitrary JavaScript. Security model: manifest-only, no code
 * execution from plugins.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface PluginManifest {
  name: string
  version: string
  description?: string
  author?: string
  /** What this plugin contributes */
  contributes?: {
    commands?: Array<{ id: string; label: string }>
    skills?: Array<{ id: string; path: string }>
    prompts?: Array<{ id: string; name: string; body: string }>
  }
}

export interface PluginEntry {
  id: string
  manifest: PluginManifest
  path: string
  enabled: boolean
  source: 'local' | 'global'
}

const PLUGIN_DIRS = [
  { path: join(homedir(), '.agenthub', 'plugins'), source: 'global' as const },
  { path: '.agenthub', source: 'local' as const }
]

/**
 * Scan for installed plugins.
 */
export function scanPlugins(workspaceRoot?: string): PluginEntry[] {
  const plugins: PluginEntry[] = []
  for (const dir of PLUGIN_DIRS) {
    const dirPath = dir.source === 'local' && workspaceRoot ? join(workspaceRoot, dir.path) : dir.path
    if (!existsSync(dirPath)) continue
    try {
      const entries = readdirSync(dirPath)
      for (const entry of entries) {
        const pluginDir = join(dirPath, entry)
        if (!statSync(pluginDir).isDirectory()) continue
        const manifestPath = join(pluginDir, 'manifest.json')
        if (!existsSync(manifestPath)) continue
        try {
          const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
          if (!manifest.name || !manifest.version) continue
          plugins.push({
            id: `${dir.source}::${entry}`,
            manifest,
            path: pluginDir,
            enabled: true,
            source: dir.source
          })
        } catch { /* skip invalid manifest */ }
      }
    } catch { /* skip inaccessible dir */ }
  }
  return plugins
}

/**
 * Validate a plugin manifest.
 */
export function validateManifest(manifest: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['Not an object'] }
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('Missing or invalid name')
  if (!manifest.version || typeof manifest.version !== 'string') errors.push('Missing or invalid version')
  if (manifest.contributes) {
    if (manifest.contributes.commands && !Array.isArray(manifest.contributes.commands)) errors.push('contributes.commands must be an array')
    if (manifest.contributes.skills && !Array.isArray(manifest.contributes.skills)) errors.push('contributes.skills must be an array')
    if (manifest.contributes.prompts && !Array.isArray(manifest.contributes.prompts)) errors.push('contributes.prompts must be an array')
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Get all contributions from enabled plugins.
 */
export function getPluginContributions(plugins: PluginEntry[]): {
  commands: Array<{ pluginId: string; id: string; label: string }>
  skills: Array<{ pluginId: string; id: string; path: string }>
  prompts: Array<{ pluginId: string; id: string; name: string; body: string }>
} {
  const commands: Array<{ pluginId: string; id: string; label: string }> = []
  const skills: Array<{ pluginId: string; id: string; path: string }> = []
  const prompts: Array<{ pluginId: string; id: string; name: string; body: string }> = []

  for (const plugin of plugins.filter(p => p.enabled)) {
    const c = plugin.manifest.contributes
    if (!c) continue
    if (c.commands) commands.push(...c.commands.map(cmd => ({ pluginId: plugin.id, ...cmd })))
    if (c.skills) skills.push(...c.skills.map(s => ({ pluginId: plugin.id, ...s })))
    if (c.prompts) prompts.push(...c.prompts.map(p => ({ pluginId: plugin.id, ...p })))
  }
  return { commands, skills, prompts }
}
