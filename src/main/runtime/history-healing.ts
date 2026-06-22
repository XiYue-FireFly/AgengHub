/**
 * HistoryHealing: repair loaded history items for model consumption.
 *
 * Inspired by Kun's history-healing.ts. Normalizes loaded conversation items
 * to ensure they have valid structure before sending to the model.
 *
 * R15-aligned: Kun loop/history-healing reference pattern.
 */

export interface HealedItem {
  id: string
  role: string
  content: string
  kind?: string
  [key: string]: unknown
}

export interface HistoryHealingResult<T> {
  items: T[]
  changed: boolean
}

/**
 * Heal loaded history items by normalizing structure.
 * - Ensures all items have valid id, role, and content
 * - Removes null/undefined items
 * - Normalizes role strings
 */
export function healLoadedHistoryItems<T extends { id?: string; role?: string; content?: string; kind?: string }>(
  items: readonly T[]
): HistoryHealingResult<T> {
  let changed = false
  const healed: T[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') {
      changed = true
      continue
    }

    const normalized = { ...item }

    // Ensure id
    if (!normalized.id || typeof normalized.id !== 'string') {
      (normalized as any).id = `item_healed_${i}_${normalized.role || 'unknown'}`
      changed = true
    }

    // Normalize role
    if (normalized.role) {
      const roleMap: Record<string, string> = {
        'human': 'user',
        'bot': 'assistant',
        'ai': 'assistant',
        'system': 'system'
      }
      const mappedRole = roleMap[normalized.role.toLowerCase()]
      if (mappedRole && mappedRole !== normalized.role) {
        (normalized as any).role = mappedRole
        changed = true
      }
    }

    // Ensure content is string
    if (normalized.content !== undefined && typeof normalized.content !== 'string') {
      (normalized as any).content = String(normalized.content)
      changed = true
    }

    healed.push(normalized as T)
  }

  return { items: healed, changed }
}

/**
 * Validate that a history item has minimum required fields.
 */
export function isValidHistoryItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const obj = item as Record<string, unknown>
  return typeof obj.role === 'string' && (typeof obj.content === 'string' || obj.content === undefined)
}
