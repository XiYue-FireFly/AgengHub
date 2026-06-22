import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const memory: Record<string, any> = {}
vi.mock('../../store', () => ({ store: { get: (k: string) => memory[k], set: (k: string, v: any) => { memory[k] = v } } }))

describe('workflow-center', () => {
  it('substitutes variables in template', async () => {
    const { substituteVariables } = await import('../workflow-center')
    const result = substituteVariables('Hello {{name}}, you are {{age}} years old', [
      { name: 'name', value: 'Alice', type: 'string' },
      { name: 'age', value: '30', type: 'number' }
    ])
    expect(result).toBe('Hello Alice, you are 30 years old')
  })

  it('evaluates simple conditions', async () => {
    const { evaluateCondition } = await import('../workflow-center')
    const vars = [{ name: 'count', value: '5', type: 'number' as const }]
    expect(evaluateCondition('{{count}} > 3', vars)).toBe(true)
    expect(evaluateCondition('{{count}} < 3', vars)).toBe(false)
    expect(evaluateCondition('{{count}} == 5', vars)).toBe(true)
  })

  it('saves and loads run history', async () => {
    const { saveRunRecord, loadRunHistory } = await import('../workflow-center')
    saveRunRecord({
      workflowId: 'wf-1', runId: 'r-1', workflowName: 'Test',
      startedAt: new Date().toISOString(), status: 'succeeded', stepResults: []
    })
    const history = loadRunHistory()
    expect(history).toHaveLength(1)
    expect(history[0].workflowId).toBe('wf-1')
  })
})

describe('project-knowledge-enhanced', () => {
  it('detects Node.js/React project', async () => {
    const { detectTechStack } = await import('../project-knowledge-enhanced')
    const dir = mkdtempSync(join(tmpdir(), 'agenthub-pk-'))
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'test', dependencies: { react: '^18.0.0' }, devDependencies: { vitest: '^1.0.0' }
    }))
    const result = detectTechStack(dir)
    expect(result.language).toBe('JavaScript/TypeScript')
    expect(result.framework).toBe('React')
    expect(result.testFramework).toBe('Vitest')
  })

  it('detects Rust project', async () => {
    const { detectTechStack } = await import('../project-knowledge-enhanced')
    const dir = mkdtempSync(join(tmpdir(), 'agenthub-pk-rust-'))
    writeFileSync(join(dir, 'Cargo.toml'), '[package]\nname = "test"')
    const result = detectTechStack(dir)
    expect(result.language).toBe('Rust')
    expect(result.packageManager).toBe('cargo')
  })

  it('generates workspace summary', async () => {
    const { generateWorkspaceSummary } = await import('../project-knowledge-enhanced')
    const dir = mkdtempSync(join(tmpdir(), 'agenthub-pk-sum-'))
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }))
    const summary = generateWorkspaceSummary(dir, [
      { title: 'Build command', content: 'npm run build', category: 'build' }
    ])
    expect(summary).toContain('Language:')
    expect(summary).toContain('Build command')
  })
})

describe('plugin-manager-enhanced', () => {
  beforeEach(() => { for (const k of Object.keys(memory)) delete memory[k]; vi.resetModules() })

  it('installs and lists plugins', async () => {
    const { installPlugin, listInstalledPlugins } = await import('../plugin-manager-enhanced')
    installPlugin({ id: 'p1', name: 'Plugin 1', version: '1.0.0' })
    const list = listInstalledPlugins()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Plugin 1')
  })

  it('uninstalls plugin', async () => {
    const { installPlugin, uninstallPlugin, listInstalledPlugins } = await import('../plugin-manager-enhanced')
    installPlugin({ id: 'p2', name: 'Plugin 2', version: '1.0.0' })
    expect(uninstallPlugin('p2')).toBe(true)
    expect(listInstalledPlugins()).toHaveLength(0)
  })

  it('toggles plugin enabled state', async () => {
    const { installPlugin, togglePlugin, getInstalledPlugin } = await import('../plugin-manager-enhanced')
    installPlugin({ id: 'p3', name: 'Plugin 3', version: '1.0.0' })
    expect(togglePlugin('p3')).toBe(false)
    expect(getInstalledPlugin('p3')!.enabled).toBe(false)
    expect(togglePlugin('p3')).toBe(true)
    expect(getInstalledPlugin('p3')!.enabled).toBe(true)
  })

  it('gets enabled contributions', async () => {
    const { installPlugin, getEnabledContributions } = await import('../plugin-manager-enhanced')
    installPlugin({
      id: 'p4', name: 'Plugin 4', version: '1.0.0',
      contributes: { commands: [{ id: 'c1', label: 'Cmd 1' }], prompts: [{ id: 'pr1', name: 'Prompt 1', body: 'hello' }] }
    })
    installPlugin({ id: 'p5', name: 'Plugin 5', version: '1.0.0' })
    const contribs = getEnabledContributions()
    expect(contribs.commands).toHaveLength(1)
    expect(contribs.prompts).toHaveLength(1)
  })
})
