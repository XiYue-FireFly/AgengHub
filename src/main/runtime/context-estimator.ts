/**
 * ContextEstimator: token estimator for context window management.
 *
 * Inspired by Kun's context-estimator.ts. Provides accurate token estimates
 * for CJK-heavy text by counting CJK characters as ~1 token each and packing
 * ASCII runs at ~4 chars/token.
 *
 * R15-aligned: Kun loop/context-estimator reference pattern.
 */

export class ContextEstimator {
  private readonly charsPerToken: number

  constructor(charsPerToken = 4) {
    this.charsPerToken = Math.max(1, charsPerToken)
  }

  /** Estimate tokens for a raw string. */
  estimateText(text: string): number {
    if (!text) return 0
    let asciiRun = 0
    let tokens = 0
    for (const char of text) {
      if (char.charCodeAt(0) <= 0x7f) {
        asciiRun += 1
      } else {
        if (asciiRun > 0) {
          tokens += Math.ceil(asciiRun / this.charsPerToken)
          asciiRun = 0
        }
        tokens += isCombiningMark(char) ? 0 : 1
      }
    }
    if (asciiRun > 0) tokens += Math.ceil(asciiRun / this.charsPerToken)
    return Math.max(0, tokens)
  }

  /** Estimate tokens for an array of text items. */
  estimateItems(items: Array<{ text?: string; content?: string }>): number {
    return items.reduce((sum, item) => sum + this.estimateText(item.text || item.content || ''), 0)
  }

  /** Estimate tokens for a tool specification. */
  estimateTool(tool: { name: string; description?: string; inputSchema?: unknown }): number {
    const parts = [tool.name, tool.description || '', JSON.stringify(tool.inputSchema || {})]
    return this.estimateText(parts.join('\n'))
  }

  /** Estimate tokens for an array of tool specifications. */
  estimateTools(tools: Array<{ name: string; description?: string; inputSchema?: unknown }>): number {
    return tools.reduce((sum, tool) => sum + this.estimateTool(tool), 0)
  }
}

/** Check if a character is a zero-width combining mark. */
function isCombiningMark(char: string): boolean {
  const code = char.charCodeAt(0)
  // Zero-width joiner, combining diacritical marks, etc.
  return code === 0x200d || (code >= 0x0300 && code <= 0x036f) || (code >= 0xfe20 && code <= 0xfe2f)
}

/** Singleton instance for convenience. */
export const defaultEstimator = new ContextEstimator()
