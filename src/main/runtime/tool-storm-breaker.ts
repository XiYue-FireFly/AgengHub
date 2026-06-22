/**
 * ToolStormBreaker: prevents repeated identical tool calls from inflating
 * dynamic history and cache misses.
 *
 * Inspired by Kun's tool-storm-breaker.ts. Deliberately turn-scoped;
 * a new user turn is a new intent, so the breaker resets between turns.
 *
 * R15-aligned: Kun loop/tool-storm-breaker reference pattern.
 */

export interface ToolStormBreakerOptions {
  /** Number of recent tool calls to track */
  windowSize?: number
  /** Number of identical calls before suppression */
  threshold?: number
}

interface RecentToolCall {
  name: string
  args: string
  readOnly: boolean
}

const DEFAULT_WINDOW_SIZE = 8
const DEFAULT_THRESHOLD = 3
const MUTATING_TOOL_NAMES = new Set(['write', 'edit', 'edit_diff', 'apply_patch', 'delete', 'move'])
const STORM_EXEMPT_TOOL_NAMES = new Set(['request_user_input', 'user_input'])

export class ToolStormBreaker {
  private readonly windowSize: number
  private readonly threshold: number
  private readonly recent: RecentToolCall[] = []

  constructor(options: ToolStormBreakerOptions = {}) {
    this.windowSize = Math.max(1, Math.floor(options.windowSize ?? DEFAULT_WINDOW_SIZE))
    this.threshold = Math.max(2, Math.floor(options.threshold ?? DEFAULT_THRESHOLD))
  }

  /**
   * Inspect a tool call for storm detection.
   * Returns { suppress: true, reason } if the call should be suppressed.
   */
  inspect(toolName: string, args: unknown): { suppress: boolean; reason?: string } {
    if (STORM_EXEMPT_TOOL_NAMES.has(toolName)) return { suppress: false }

    const argsStr = stableStringify(args)
    const readOnly = !MUTATING_TOOL_NAMES.has(toolName)

    if (!readOnly) {
      this.clearReadOnlyEntries()
    }

    const count = this.recent.reduce(
      (sum, entry) => sum + (entry.name === toolName && entry.args === argsStr ? 1 : 0),
      0
    )

    if (count >= this.threshold - 1) {
      return {
        suppress: true,
        reason:
          `${toolName} was called with identical arguments ${count + 1} times in this turn; ` +
          'repeat-loop guard suppressed the duplicate. Choose a narrower query or explain why another identical call is needed.'
      }
    }

    this.recent.push({ name: toolName, args: argsStr, readOnly })
    while (this.recent.length > this.windowSize) this.recent.shift()
    return { suppress: false }
  }

  /** Reset the breaker for a new turn. */
  reset(): void {
    this.recent.length = 0
  }

  /** Get the number of tracked recent calls. */
  size(): number {
    return this.recent.length
  }

  private clearReadOnlyEntries(): void {
    for (let i = this.recent.length - 1; i >= 0; i--) {
      if (this.recent[i].readOnly) this.recent.splice(i, 1)
    }
  }
}

/** Stable JSON stringify for comparison. */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())
  } catch {
    return String(value)
  }
}
