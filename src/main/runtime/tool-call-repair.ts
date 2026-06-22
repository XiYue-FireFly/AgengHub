/**
 * ToolCallRepair: provider-neutral repair pass for tool call arguments.
 *
 * Inspired by Kun's tool-call-repair.ts. Catches provider-agnostic shapes
 * that can still reach the loop as Records, such as nested wrapper keys
 * or oversized argument strings.
 *
 * R15-aligned: Kun loop/tool-call-repair reference pattern.
 */

export interface ToolCallRepairOptions {
  toolName?: string
  maxStringBytes?: number
}

export interface ToolCallRepairResult {
  arguments: Record<string, unknown>
  notes: string[]
}

const DEFAULT_MAX_STRING_BYTES = 512 * 1024
const WRAPPER_KEYS = ['arguments', 'args', 'input', 'parameters', 'params', 'payload', '__raw']
const TOOL_METADATA_KEYS = new Set([
  'tool', 'toolName', 'tool_name', 'name', 'id', 'callId', 'call_id', 'type'
])

/**
 * Repair tool call arguments by unwrapping nested wrappers and
 * truncating oversized strings.
 */
export function repairToolCallArguments(
  raw: Record<string, unknown>,
  options: ToolCallRepairOptions = {}
): ToolCallRepairResult {
  const notes: string[] = []
  let current = shallowCloneRecord(raw)

  // Unwrap nested wrapper keys
  const unwrapped = unwrapNested(current)
  if (unwrapped) {
    current = unwrapped.arguments
    notes.push(unwrapped.note)
  }

  // Truncate oversized strings
  const truncated = truncateOversizedStrings(current, options.maxStringBytes ?? DEFAULT_MAX_STRING_BYTES)
  if (truncated.changed) {
    current = truncated.value
    notes.push(`truncated ${truncated.count} oversized argument string(s)`)
  }

  return { arguments: current, notes }
}

function shallowCloneRecord(obj: Record<string, unknown>): Record<string, unknown> {
  return { ...obj }
}

function unwrapNested(
  obj: Record<string, unknown>
): { arguments: Record<string, unknown>; note: string } | null {
  // Check if the object has exactly one key that is a wrapper key
  const keys = Object.keys(obj).filter(k => !TOOL_METADATA_KEYS.has(k))
  if (keys.length === 1 && WRAPPER_KEYS.includes(keys[0])) {
    const value = obj[keys[0]]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { arguments: value as Record<string, unknown>, note: `unwrapped ${keys[0]} wrapper` }
    }
    // If the value is a JSON string, try to parse it
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { arguments: parsed, note: `parsed ${keys[0]} JSON string` }
        }
      } catch {
        // not valid JSON, skip
      }
    }
  }
  return null
}

function truncateOversizedStrings(
  obj: Record<string, unknown>,
  maxBytes: number
): { value: Record<string, unknown>; changed: boolean; count: number } {
  let changed = false
  let count = 0
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > maxBytes) {
      result[key] = value.slice(0, maxBytes) + '...[truncated]'
      changed = true
      count++
    } else {
      result[key] = value
    }
  }

  return { value: result, changed, count }
}
