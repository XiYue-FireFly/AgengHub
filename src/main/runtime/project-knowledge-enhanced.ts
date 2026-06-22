/**
 * ProjectKnowledgeEnhanced: enhanced project knowledge management.
 *
 * Extends project-knowledge with auto-detection of tech stack,
 * build commands, and conventions from workspace files.
 *
 * P4-F6: Project Knowledge.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DetectedTechStack {
  language: string
  framework?: string
  packageManager?: string
  testFramework?: string
  buildTool?: string
}

/**
 * Auto-detect tech stack from workspace files.
 */
export function detectTechStack(workspaceRoot: string): DetectedTechStack {
  const result: DetectedTechStack = { language: 'unknown' }

  // Check package.json
  if (existsSync(join(workspaceRoot, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf-8'))
      result.language = 'JavaScript/TypeScript'
      result.packageManager = existsSync(join(workspaceRoot, 'pnpm-lock.yaml')) ? 'pnpm'
        : existsSync(join(workspaceRoot, 'yarn.lock')) ? 'yarn'
        : 'npm'

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps.react) result.framework = 'React'
      else if (deps.vue) result.framework = 'Vue'
      else if (deps.svelte) result.framework = 'Svelte'
      else if (deps.angular) result.framework = 'Angular'

      if (deps.vitest) result.testFramework = 'Vitest'
      else if (deps.jest) result.testFramework = 'Jest'

      if (deps.vite || deps['@vitejs/plugin-react']) result.buildTool = 'Vite'
      else if (deps.webpack) result.buildTool = 'Webpack'
    } catch { /* ignore parse errors */ }
  }

  // Check for other languages
  if (result.language === 'unknown') {
    if (existsSync(join(workspaceRoot, 'Cargo.toml'))) {
      result.language = 'Rust'
      result.packageManager = 'cargo'
      result.buildTool = 'cargo'
    } else if (existsSync(join(workspaceRoot, 'go.mod'))) {
      result.language = 'Go'
      result.packageManager = 'go'
    } else if (existsSync(join(workspaceRoot, 'requirements.txt')) || existsSync(join(workspaceRoot, 'pyproject.toml'))) {
      result.language = 'Python'
      result.packageManager = existsSync(join(workspaceRoot, 'poetry.lock')) ? 'poetry'
        : existsSync(join(workspaceRoot, 'uv.lock')) ? 'uv'
        : 'pip'
    }
  }

  return result
}

/**
 * Generate a workspace context summary for AI injection.
 */
export function generateWorkspaceSummary(workspaceRoot: string, entries: Array<{ title: string; content: string; category: string }>): string {
  const techStack = detectTechStack(workspaceRoot)
  const parts: string[] = []

  parts.push(`Language: ${techStack.language}`)
  if (techStack.framework) parts.push(`Framework: ${techStack.framework}`)
  if (techStack.packageManager) parts.push(`Package manager: ${techStack.packageManager}`)
  if (techStack.testFramework) parts.push(`Test framework: ${techStack.testFramework}`)
  if (techStack.buildTool) parts.push(`Build tool: ${techStack.buildTool}`)

  if (entries.length > 0) {
    parts.push(`\nProject knowledge (${entries.length} entries):`)
    for (const entry of entries.slice(0, 10)) {
      parts.push(`- [${entry.category}] ${entry.title}: ${entry.content.slice(0, 100)}`)
    }
  }

  return parts.join('\n')
}
