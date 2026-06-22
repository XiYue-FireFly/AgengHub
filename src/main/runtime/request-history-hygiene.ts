/**
 * RequestHistoryHygiene: send-time history hygiene for long sessions.
 *
 * Inspired by Kun's request-history-hygiene.ts. Applies cumulative token
 * budgets to tool results in the sent history, preventing runaway context
 * growth from accumulated tool output in long sessions.
 *
 * R15-aligned: Kun loop/request-history-hygiene reference pattern.
 */

export interface RequestHistoryHygieneOptions {
  /** Maximum lines per tool result */
  maxToolResultLines?: number
  /** Maximum bytes per tool result */
  maxToolResultBytes?: number
  /** Maximum tokens per tool result */
  maxToolResultTokens?: number
  /** Maximum cumulative tool result tokens across all history */
  maxCumulativeToolResultTokens?: number
  /** Number of most-recent tool results kept at full fidelity */
  keepRecentToolResults?: number
}

export interface HygieneResult<T> {
  items: T[]
  changed: boolean
  truncatedCount: number
}

const DEFAULT_OPTIONS: Required<RequestHistoryHygieneOptions> = {
  maxToolResultLines: 320,
  maxToolResultBytes: 32 * 1024,
  maxToolResultTokens: 8_000,
  maxCumulativeToolResultTokens: 120_000,
  keepRecentToolResults: 4
}

/** Normalize partial options to full defaults. */
export function normalizeHygieneOptions(
  input: RequestHistoryHygieneOptions | undefined
): Required<RequestHistoryHygieneOptions> {
  return { ...DEFAULT_OPTIONS, ...(input ?? {}) }
}

/** Estimate tokens for a text string (CJK-aware). */
function estimateTokens(text: string): number {
  if (!text) return 0
  let asciiRun = 0
  let tokens = 0
  for (const char of text) {
    if (char.charCodeAt(0) <= 0x7f) {
      asciiRun += 1
    } else {
      if (asciiRun > 0) {
        tokens += Math.ceil(asciiRun / 4)
        asciiRun = 0
      }
      tokens += 1
    }
  }
  if (asciiRun > 0) tokens += Math.ceil(asciiRun / 4)
  return Math.max(0, tokens)
}

/** Truncate text to fit within token budget. */
function truncateToTokenBudget(text: string, maxTokens: number): { text: string; truncated: boolean } {
  if (!text) return { text: '', truncated: false }
  const estimated = estimateTokens(text)
  if (estimated <= maxTokens) return { text, truncated: false }
  const maxChars = maxTokens * 4
  return { text: text.slice(0, maxChars) + '\n...[truncated]', truncated: true }
}

/**
 * Apply hygiene to tool results in a history array.
 * Tool results are kept in full from newest to oldest until the cumulative
 * budget is consumed; older results beyond the budget are truncated.
 */
export function applyToolResultHygiene(
  history: Array<{ role: string; content: string; isToolResult?: boolean }>,
  options?: RequestHistoryHygieneOptions
): HygieneResult<typeof history[0]> {
  const opts = normalizeHygieneOptions(options)
  let changed = false
  let truncatedCount = 0
  let cumulativeTokens = 0

  // Process from newest to oldest
  const result = [...history]
  let recentKept = 0

  for (let i = result.length - 1; i >= 0; i--) {
    const item = result[i]
    if (!item.isToolResult) continue

    const tokens = estimateTokens(item.content)

    // Keep recent tool results at full fidelity
    if (recentKept < opts.keepRecentToolResults) {
      recentKept++
      cumulativeTokens += tokens
      continue
    }

    // Check cumulative budget
    if (opts.maxCumulativeToolResultTokens > 0 && cumulativeTokens + tokens > opts.maxCumulativeToolResultTokens) {
      // Truncate this tool result
      const { text, truncated } = truncateToTokenBudget(item.content, opts.maxToolResultTokens)
      if (truncated) {
        result[i] = { ...item, content: text }
        changed = true
        truncatedCount++
      }
    }

    cumulativeTokens += tokens
  }

  return { items: result, changed, truncatedCount }
}
