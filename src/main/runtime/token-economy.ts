/**
 * Token Economy: configuration and utilities for token-aware request optimization.
 *
 * Inspired by Kun's token-economy.ts. Provides:
 * - Configurable token budget enforcement
 * - Tool description/result compression
 * - Concise response directives
 * - Request history hygiene (cumulative tool result budget)
 *
 * R15-aligned: Kun loop/token-economy reference pattern.
 */

export interface TokenEconomyConfig {
  /** Enable token economy mode (adds concise response instruction) */
  enabled?: boolean
  /** Compress tool descriptions in requests */
  compressToolDescriptions?: boolean
  /** Compress tool results in history */
  compressToolResults?: boolean
  /** Add concise response directive to system prompt */
  conciseResponses?: boolean
  /** Maximum cumulative tool result tokens across all history */
  maxCumulativeToolResultTokens?: number
  /** Number of most-recent tool results kept at full fidelity */
  keepRecentToolResults?: number
}

export interface NormalizedTokenEconomyConfig {
  enabled: boolean
  compressToolDescriptions: boolean
  compressToolResults: boolean
  conciseResponses: boolean
  maxCumulativeToolResultTokens: number
  keepRecentToolResults: number
}

export const DEFAULT_TOKEN_ECONOMY_CONFIG: NormalizedTokenEconomyConfig = {
  enabled: false,
  compressToolDescriptions: true,
  compressToolResults: true,
  conciseResponses: true,
  maxCumulativeToolResultTokens: 120_000,
  keepRecentToolResults: 4
}

export const TOKEN_ECONOMY_INSTRUCTION = [
  'Token economy mode is enabled.',
  'Reply concisely: answer directly, skip pleasantries, filler, and hedging.',
  'Preserve exact code, commands, paths, URLs, identifiers, and quoted errors.',
  'When tool output says content was omitted, use narrower read/grep/bash ranges instead of guessing.'
].join('\n')

/** Normalize a partial config to a full config with defaults. */
export function normalizeTokenEconomyConfig(
  input: TokenEconomyConfig | undefined
): NormalizedTokenEconomyConfig {
  return {
    ...DEFAULT_TOKEN_ECONOMY_CONFIG,
    ...(input ?? {})
  }
}

/** Estimate tokens for a text string. CJK chars ~1 token each, ASCII ~4 chars/token. */
export function estimateTokens(text: string): number {
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

/** Truncate a tool result to fit within a token budget. */
export function truncateToolResult(
  result: string,
  maxTokens: number
): { text: string; truncated: boolean } {
  if (!result) return { text: '', truncated: false }
  const estimated = estimateTokens(result)
  if (estimated <= maxTokens) return { text: result, truncated: false }
  // Truncate to approximately maxTokens worth of text
  const maxChars = maxTokens * 4 // rough estimate
  const truncated = result.slice(0, maxChars) + '\n...[truncated by token economy]'
  return { text: truncated, truncated: true }
}
