import { describe, expect, it } from "vitest"
import {
  normalizeTokenEconomyConfig,
  estimateTokens,
  truncateToolResult,
  DEFAULT_TOKEN_ECONOMY_CONFIG,
  TOKEN_ECONOMY_INSTRUCTION
} from "../token-economy"

describe("token-economy", () => {
  describe("normalizeTokenEconomyConfig", () => {
    it("returns defaults when input is undefined", () => {
      const config = normalizeTokenEconomyConfig(undefined)
      expect(config).toEqual(DEFAULT_TOKEN_ECONOMY_CONFIG)
      expect(config.enabled).toBe(false)
      expect(config.compressToolDescriptions).toBe(true)
      expect(config.compressToolResults).toBe(true)
      expect(config.conciseResponses).toBe(true)
      expect(config.maxCumulativeToolResultTokens).toBe(120_000)
      expect(config.keepRecentToolResults).toBe(4)
    })

    it("merges partial config with defaults", () => {
      const config = normalizeTokenEconomyConfig({ enabled: true, keepRecentToolResults: 8 })
      expect(config.enabled).toBe(true)
      expect(config.keepRecentToolResults).toBe(8)
      expect(config.compressToolDescriptions).toBe(true) // default
    })
  })

  describe("estimateTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0)
      expect(estimateTokens(null as any)).toBe(0)
    })

    it("estimates ASCII text at ~4 chars per token", () => {
      expect(estimateTokens("hello")).toBe(2) // 5 chars / 4 = 1.25 -> 2
      expect(estimateTokens("a".repeat(16))).toBe(4) // 16 / 4 = 4
    })

    it("estimates CJK text at ~1 token per character", () => {
      expect(estimateTokens("你好世界")).toBe(4) // 4 CJK chars
      expect(estimateTokens("テスト")).toBe(3) // 3 Japanese chars
    })

    it("handles mixed ASCII and CJK", () => {
      const text = "hello你好world世界"
      // "hello" = 5 chars -> 2 tokens, "你好" = 2 tokens, "world" = 5 chars -> 2 tokens, "世界" = 2 tokens
      expect(estimateTokens(text)).toBe(8)
    })
  })

  describe("truncateToolResult", () => {
    it("does not truncate short results", () => {
      const result = truncateToolResult("short result", 1000)
      expect(result.text).toBe("short result")
      expect(result.truncated).toBe(false)
    })

    it("truncates long results", () => {
      const longText = "x".repeat(100000)
      const result = truncateToolResult(longText, 100)
      expect(result.truncated).toBe(true)
      expect(result.text.length).toBeLessThan(longText.length)
      expect(result.text).toContain("[truncated by token economy]")
    })

    it("handles empty input", () => {
      const result = truncateToolResult("", 100)
      expect(result.text).toBe("")
      expect(result.truncated).toBe(false)
    })
  })

  describe("TOKEN_ECONOMY_INSTRUCTION", () => {
    it("contains concise response directive", () => {
      expect(TOKEN_ECONOMY_INSTRUCTION).toContain("concisely")
      expect(TOKEN_ECONOMY_INSTRUCTION).toContain("Token economy")
    })
  })
})
