/**
 * Keyboard Shortcuts: configurable shortcut bindings.
 *
 * Default shortcuts for common actions. Users can customize bindings.
 * Persisted via store key `shortcuts.v1`.
 */

import { store } from '../store'

const STORAGE_KEY = 'shortcuts.v1'

export interface ShortcutBinding {
  id: string
  /** Display label */
  label: string
  labelZh: string
  /** Default key combination */
  defaultKey: string
  /** Current key combination (may differ from default if customized) */
  key: string
  /** Category for grouping in the settings UI */
  category: 'navigation' | 'action' | 'editor' | 'agent'
  /** Whether this shortcut is system-defined (cannot be deleted) */
  system: boolean
}

export interface ShortcutsData {
  version: 1
  bindings: ShortcutBinding[]
}

const DEFAULT_SHORTCUTS: Omit<ShortcutBinding, 'key'>[] = [
  { id: 'open-command-palette', label: 'Open Command Palette', labelZh: '打开命令面板', defaultKey: 'Ctrl+Shift+P', category: 'navigation', system: true },
  { id: 'focus-composer', label: 'Focus Composer', labelZh: '聚焦输入框', defaultKey: 'Ctrl+L', category: 'navigation', system: true },
  { id: 'new-conversation', label: 'New Conversation', labelZh: '新建会话', defaultKey: 'Ctrl+N', category: 'navigation', system: true },
  { id: 'switch-agent', label: 'Switch Agent', labelZh: '切换 Agent', defaultKey: 'Ctrl+Shift+A', category: 'agent', system: true },
  { id: 'open-settings', label: 'Open Settings', labelZh: '打开设置', defaultKey: 'Ctrl+,', category: 'navigation', system: true },
  { id: 'open-git', label: 'Open Git Panel', labelZh: '打开 Git 面板', defaultKey: 'Ctrl+Shift+G', category: 'navigation', system: true },
  { id: 'open-memory', label: 'Open Memory', labelZh: '打开记忆', defaultKey: 'Ctrl+Shift+M', category: 'navigation', system: true },
  { id: 'open-mcp', label: 'Open MCP', labelZh: '打开 MCP', defaultKey: 'Ctrl+Shift+K', category: 'navigation', system: true },
  { id: 'open-skills', label: 'Open Skills', labelZh: '打开技能', defaultKey: 'Ctrl+Shift+S', category: 'navigation', system: true },
  { id: 'stop-task', label: 'Stop Current Task', labelZh: '停止当前任务', defaultKey: 'Ctrl+Shift+Escape', category: 'action', system: true },
  { id: 'open-workflows', label: 'Open Workflows', labelZh: '打开工作流', defaultKey: 'Ctrl+Shift+W', category: 'navigation', system: true },
  { id: 'open-tasks', label: 'Open Task Center', labelZh: '打开任务中心', defaultKey: 'Ctrl+Shift+T', category: 'navigation', system: true },
  { id: 'send-message', label: 'Send Message', labelZh: '发送消息', defaultKey: 'Enter', category: 'editor', system: true },
  { id: 'new-line', label: 'New Line in Composer', labelZh: '输入框换行', defaultKey: 'Shift+Enter', category: 'editor', system: true }
]

function emptyData(): ShortcutsData {
  return {
    version: 1,
    bindings: DEFAULT_SHORTCUTS.map(s => ({ ...s, key: s.defaultKey }))
  }
}

function readData(): ShortcutsData {
  const raw: any = store.get(STORAGE_KEY)
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.bindings)) return emptyData()
  // Merge with defaults: keep user customizations, add new defaults
  const defaults = emptyData()
  const userMap = new Map<string, any>(raw.bindings.map((b: any) => [b.id, b]))
  const merged = defaults.bindings.map(d => {
    const user = userMap.get(d.id)
    return user ? { ...d, key: user.key || d.key } : d
  })
  return { version: 1, bindings: merged }
}

function writeData(data: ShortcutsData): void { store.set(STORAGE_KEY, data) }

export function listShortcuts(category?: ShortcutBinding['category']): ShortcutBinding[] {
  const data = readData()
  return category ? data.bindings.filter(b => b.category === category) : data.bindings
}

export function getShortcut(id: string): ShortcutBinding | null {
  return readData().bindings.find(b => b.id === id) || null
}

export function updateShortcut(id: string, key: string): ShortcutBinding | null {
  const data = readData()
  const binding = data.bindings.find(b => b.id === id)
  if (!binding) return null
  binding.key = key
  writeData(data)
  return binding
}

export function resetShortcut(id: string): ShortcutBinding | null {
  const data = readData()
  const binding = data.bindings.find(b => b.id === id)
  if (!binding) return null
  binding.key = binding.defaultKey
  writeData(data)
  return binding
}

export function resetAllShortcuts(): void {
  store.set(STORAGE_KEY, null) // triggers emptyData on next read
}

/**
 * Detect conflicts: find bindings that share the same key combination.
 */
export function detectConflicts(): Array<{ key: string; ids: string[] }> {
  const data = readData()
  const byKey = new Map<string, string[]>()
  for (const b of data.bindings) {
    const existing = byKey.get(b.key) || []
    existing.push(b.id)
    byKey.set(b.key, existing)
  }
  return [...byKey.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))
}
