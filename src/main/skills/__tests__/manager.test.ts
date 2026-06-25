import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BUILTIN_SKILLS } from '../types'

/**
 * SkillManager 单测 — 覆盖：add/list、单独安装/卸载、'*' 集体安装、remove 级联清除安装表。
 * 经 vi.mock 把 store 换成内存对象（与 workspace.test.ts 同套路），与 electron 解耦。
 */

let store: Record<string, any>
let workspaceRoot: string | null = null

vi.mock('../../store', () => ({
  store: {
    get: (k: string) => store[k],
    set: (k: string, v: any) => { store[k] = v }
  }
}))

vi.mock('../../hub/workspace', () => ({
  getWorkspaceManager: () => ({
    getActive: () => 'workspace-1',
    getById: () => workspaceRoot ? { id: 'workspace-1', rootPath: workspaceRoot } : null
  })
}))

vi.mock('../../runtime/ecc-commands', () => ({ listEccCommands: () => [] }))
vi.mock('../../runtime/local-agents', () => ({
  detectLocalAgentStatuses: () => [],
  getCachedLocalAgentStatuses: () => [],
  isUsableLocalAgentStatus: () => false
}))
vi.mock('../../runtime/schedules', () => ({ listSchedules: () => [] }))

beforeEach(() => {
  store = {}
  workspaceRoot = null
})

describe('SkillManager', () => {
  it('add/list 读写一致', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const s = m.add({ name: 'A', instructions: 'do A', tags: ['x'] })
    expect(s.id).toBeTruthy()
    expect(s.category.id).toBe('general')
    expect(m.list().map(x => x.name)).toContain('A')
    expect(m.get(s.id)?.instructions).toBe('do A')
  })

  it('built-in template category is saved when added', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const s = m.add(BUILTIN_SKILLS[0])
    expect(s.category).toMatchObject({ id: 'coding' })
    expect(store['skills.v1'].skills[0].category).toMatchObject({ id: 'coding' })
  })

  it('AgentHub workflow builtin can be added, installed, and injected', async () => {
    const { getSkillManager } = await import('../manager')
    const { buildSkillBlock } = await import('../inject')
    const m = getSkillManager()
    const template = BUILTIN_SKILLS.find(skill => skill.source === 'ecc')
    expect(template).toMatchObject({
      name: 'AgentHub Workflow',
      category: { id: 'planning' },
      tags: expect.arrayContaining(['builtin', 'ecc', 'planning', 'testing', 'review', 'verification'])
    })
    expect(template?.instructions).toContain('/plan')
    expect(template?.instructions).toContain('/tdd')
    expect(template?.instructions).toContain('/verify')
    const s = m.add(template!)
    expect(s.category).toMatchObject({ id: 'planning' })
    expect(s.source).toBe('ecc')

    m.install('codex', s.id)
    expect(m.installedFor('codex').map(skill => skill.id)).toEqual([s.id])
    expect(buildSkillBlock(m.installedFor('codex'))).toContain('AgentHub Workflow')
  })

  it('legacy skills without category remain readable', async () => {
    store['skills.v1'] = {
      version: 1,
      skills: [
        { id: 'legacy', name: 'Legacy', description: '', instructions: 'old', tags: [], source: 'paste', createdAt: 1, updatedAt: 1 }
      ],
      installs: {}
    }
    const { getSkillManager } = await import('../manager')
    expect(getSkillManager().get('legacy')?.category).toMatchObject({ id: 'general' })
  })

  it('单独安装/卸载 只影响目标 agent', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const s = m.add({ name: 'A', instructions: 'x' })
    m.install('codex', s.id)
    expect(m.isInstalled('codex', s.id)).toBe(true)
    expect(m.isInstalled('claude', s.id)).toBe(false)
    expect(m.installedFor('codex').map(x => x.id)).toEqual([s.id])
    m.uninstall('codex', s.id)
    expect(m.isInstalled('codex', s.id)).toBe(false)
  })

  it("'*' 集体安装覆盖所有 manifest agent", async () => {
    const { getSkillManager } = await import('../manager')
    const { AGENTS } = await import('../../hub/agents')
    const m = getSkillManager()
    const s = m.add({ name: 'A', instructions: 'x' })
    m.install('*', s.id)
    for (const a of AGENTS) expect(m.isInstalled(a.id, s.id)).toBe(true)
  })

  it('install 未知技能为 no-op；不重复安装', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    m.install('codex', 'nope')
    expect(m.getInstalls().codex || []).not.toContain('nope')
    const s = m.add({ name: 'A', instructions: 'x' })
    m.install('codex', s.id)
    m.install('codex', s.id)
    expect((m.getInstalls().codex || []).filter(id => id === s.id)).toHaveLength(1)
  })

  it('remove 级联从安装表清除', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const s = m.add({ name: 'A', instructions: 'x' })
    m.install('*', s.id)
    expect(m.remove(s.id)).toBe(true)
    expect(m.list()).toHaveLength(0)
    expect(m.installedFor('codex')).toHaveLength(0)
  })

  it('scanLocal / importLocal 读取 category frontmatter 并导入', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'agenthub-skill-'))
    workspaceRoot = tempRoot
    const skillDir = join(tempRoot, '.agenthub', 'skills', 'writer')
    mkdirSync(skillDir, { recursive: true })
    const skillPath = join(skillDir, 'SKILL.md')
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'name: Writer',
      'description: Draft writing helper',
      'category: writing',
      'tags: [docs, polish]',
      '---',
      '',
      '# Writer',
      'Write clearly.'
    ].join('\n'), 'utf-8')

    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const local = m.scanLocal()
    const candidate = local.find(item => item.sourcePath === skillPath)
    expect(candidate?.name).toBe('Writer')
    expect(candidate?.category.id).toBe('writing')

    const imported = m.importLocal(skillPath)
    expect(imported.category.id).toBe('writing')
    expect(store['skills.v1'].skills.find((skill: any) => skill.id === imported.id)?.category).toMatchObject({ id: 'writing' })
    expect(imported.tags).toContain('docs')
  })

  it('scanLocal caches short-lived results but refreshLocal semantics can rescan', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'agenthub-skill-cache-'))
    workspaceRoot = tempRoot
    const skillDir = join(tempRoot, '.agenthub', 'skills', 'first')
    mkdirSync(skillDir, { recursive: true })
    const firstPath = join(skillDir, 'SKILL.md')
    writeFileSync(firstPath, [
      '---',
      'name: First',
      '---',
      '',
      'First instructions.'
    ].join('\n'), 'utf-8')

    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    expect(m.scanLocal().map(item => item.name)).toContain('First')

    const secondDir = join(tempRoot, '.agenthub', 'skills', 'second')
    mkdirSync(secondDir, { recursive: true })
    writeFileSync(join(secondDir, 'SKILL.md'), [
      '---',
      'name: Second',
      '---',
      '',
      'Second instructions.'
    ].join('\n'), 'utf-8')

    expect(m.scanLocal().map(item => item.name)).not.toContain('Second')
    expect(m.scanLocal({ refresh: true }).map(item => item.name)).toContain('Second')
  })

  it('scanLocal skips heavy cache directories while scanning workspace skills', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'agenthub-skill-skip-'))
    workspaceRoot = tempRoot
    const validDir = join(tempRoot, '.agenthub', 'skills', 'valid')
    const cacheDir = join(tempRoot, '.agenthub', 'skills', 'cache', 'ignored')
    mkdirSync(validDir, { recursive: true })
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(validDir, 'SKILL.md'), [
      '---',
      'name: Valid',
      '---',
      '',
      'Valid instructions.'
    ].join('\n'), 'utf-8')
    writeFileSync(join(cacheDir, 'SKILL.md'), [
      '---',
      'name: Ignored Cache Skill',
      '---',
      '',
      'This should not block or appear.'
    ].join('\n'), 'utf-8')

    const { getSkillManager } = await import('../manager')
    const names = getSkillManager().scanLocal({ refresh: true }).map(item => item.name)

    expect(names).toContain('Valid')
    expect(names).not.toContain('Ignored Cache Skill')
  })

  it('workbench skill commands expose category metadata', async () => {
    const { getSkillManager } = await import('../manager')
    const { listWorkbenchCommands } = await import('../../runtime/commands')
    const skill = getSkillManager().add({ name: 'Research Helper', category: 'research', instructions: 'Find sources' })
    const command = listWorkbenchCommands().find(item => item.id === `skill:${skill.id}`)
    expect(command?.payload?.category).toMatchObject({ id: 'research' })
  })

  it('finds prompt-matching skills by name, description, and tags with instructions', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const planner = m.add({
      name: 'Planning Coach',
      description: 'Break implementation work into safe steps',
      instructions: 'Always write a plan before coding.',
      tags: ['plan', 'architecture']
    })
    const tester = m.add({
      name: 'TDD Helper',
      description: 'Write failing tests before changing code',
      instructions: 'Use red-green-refactor.',
      tags: ['testing', 'vitest']
    })
    m.add({
      name: 'Gardening Notes',
      description: 'Plant watering schedule',
      instructions: 'Water deeply.',
      tags: ['plants']
    })

    const matches = m.findMatchingSkills('Please plan this architecture change and add vitest coverage')

    expect(matches.map(match => match.id)).toEqual([planner.id, tester.id])
    expect(matches[0]).toMatchObject({ name: 'Planning Coach', instructions: 'Always write a plan before coding.' })
    expect(matches[1]).toMatchObject({ name: 'TDD Helper', instructions: 'Use red-green-refactor.' })
  })

  it('limits prompt skill matches to the top three ranked results', async () => {
    const { getSkillManager } = await import('../manager')
    const m = getSkillManager()
    const first = m.add({ name: 'React Performance', description: 'React profiler and render performance', instructions: 'Profile renders.', tags: ['react', 'performance'] })
    const second = m.add({ name: 'React Accessibility', description: 'Accessible React UI', instructions: 'Check ARIA.', tags: ['react', 'a11y'] })
    const third = m.add({ name: 'React Testing', description: 'Vitest React component tests', instructions: 'Test components.', tags: ['react', 'testing'] })
    m.add({ name: 'React Animation', description: 'Motion for React', instructions: 'Animate carefully.', tags: ['react', 'motion'] })

    const matches = m.findMatchingSkills('react performance testing accessibility motion')

    expect(matches.map(match => match.id)).toEqual([first.id, third.id, second.id])
  })
})
