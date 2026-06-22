/**
 * Project Knowledge: manage project-specific context and facts.
 *
 * Stores project-level knowledge that persists across sessions:
 * architecture decisions, conventions, dependency info, build commands.
 * Different from memory (which is conversation-derived) — this is
 * explicitly curated project context.
 */

import { store } from '../store'

const STORAGE_KEY = 'project-knowledge.v1'

export type KnowledgeCategory = 'architecture' | 'convention' | 'dependency' | 'build' | 'deploy' | 'testing' | 'custom'

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  tags: string[]
  /** Workspace this knowledge belongs to (null = global) */
  workspaceId: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectKnowledgeData {
  version: 1
  entries: KnowledgeEntry[]
}

function emptyData(): ProjectKnowledgeData { return { version: 1, entries: [] } }

function readData(): ProjectKnowledgeData {
  const raw: any = store.get(STORAGE_KEY)
  if (!raw || typeof raw !== 'object') return emptyData()
  const entries = Array.isArray(raw.entries) ? raw.entries.filter((e: any) => e?.id && e?.title) : []
  return { version: 1, entries }
}

function writeData(data: ProjectKnowledgeData): void { store.set(STORAGE_KEY, data) }

export function listKnowledge(workspaceId?: string | null, category?: KnowledgeCategory): KnowledgeEntry[] {
  const data = readData()
  let entries = data.entries
  if (workspaceId !== undefined) entries = entries.filter(e => e.workspaceId === workspaceId || e.workspaceId === null)
  if (category) entries = entries.filter(e => e.category === category)
  return entries.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt))
}

export function getKnowledge(id: string): KnowledgeEntry | null {
  return readData().entries.find(e => e.id === id) || null
}

export function upsertKnowledge(input: Partial<KnowledgeEntry> & { title: string; content: string }): KnowledgeEntry {
  const data = readData()
  const now = new Date().toISOString()
  const id = input.id || `know-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const existing = data.entries.findIndex(e => e.id === id)
  const entry: KnowledgeEntry = {
    id,
    title: input.title,
    content: input.content,
    category: input.category || 'custom',
    tags: input.tags || [],
    workspaceId: input.workspaceId ?? null,
    pinned: input.pinned ?? false,
    createdAt: existing >= 0 ? data.entries[existing].createdAt : now,
    updatedAt: now
  }
  if (existing >= 0) data.entries[existing] = entry
  else data.entries.push(entry)
  writeData(data)
  return entry
}

export function deleteKnowledge(id: string): boolean {
  const data = readData()
  const before = data.entries.length
  data.entries = data.entries.filter(e => e.id !== id)
  if (data.entries.length !== before) { writeData(data); return true }
  return false
}

export function searchKnowledge(query: string, workspaceId?: string | null): KnowledgeEntry[] {
  const needle = query.trim().toLowerCase()
  const entries = listKnowledge(workspaceId)
  if (!needle) return entries
  return entries.filter(e =>
    e.title.toLowerCase().includes(needle) ||
    e.content.toLowerCase().includes(needle) ||
    e.tags.some(t => t.toLowerCase().includes(needle))
  )
}
