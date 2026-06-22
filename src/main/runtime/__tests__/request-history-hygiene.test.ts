import { describe, expect, it } from "vitest"
import {
  normalizeHygieneOptions,
  applyToolResultHygiene
} from "../request-history-hygiene"

describe("request-history-hygiene", () => {
  describe("normalizeHygieneOptions", () => {
    it("returns defaults when input is undefined", () => {
      const opts = normalizeHygieneOptions(undefined)
      expect(opts.maxToolResultLines).toBe(320)
      expect(opts.maxToolResultBytes).toBe(32 * 1024)
      expect(opts.maxToolResultTokens).toBe(8_000)
      expect(opts.maxCumulativeToolResultTokens).toBe(120_000)
      expect(opts.keepRecentToolResults).toBe(4)
    })

    it("merges partial options with defaults", () => {
      const opts = normalizeHygieneOptions({ keepRecentToolResults: 8 })
      expect(opts.keepRecentToolResults).toBe(8)
      expect(opts.maxToolResultLines).toBe(320) // default
    })
  })

  describe("applyToolResultHygiene", () => {
    it("does not modify non-tool-result items", () => {
      const history = [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi there" }
      ]
      const result = applyToolResultHygiene(history)
      expect(result.changed).toBe(false)
      expect(result.truncatedCount).toBe(0)
      expect(result.items).toEqual(history)
    })

    it("keeps recent tool results at full fidelity", () => {
      const history = [
        { role: "user", content: "read file" },
        { role: "tool", content: "x".repeat(50000), isToolResult: true },
        { role: "tool", content: "y".repeat(50000), isToolResult: true }
      ]
      const result = applyToolResultHygiene(history, { keepRecentToolResults: 4 })
      expect(result.changed).toBe(false)
      expect(result.items[1].content).toBe("x".repeat(50000))
      expect(result.items[2].content).toBe("y".repeat(50000))
    })

    it("truncates old tool results when cumulative budget exceeded", () => {
      const bigContent = "a".repeat(200000) // ~50k tokens
      const history = [
        { role: "tool", content: bigContent, isToolResult: true },
        { role: "tool", content: bigContent, isToolResult: true },
        { role: "tool", content: bigContent, isToolResult: true },
        { role: "tool", content: bigContent, isToolResult: true },
        { role: "tool", content: bigContent, isToolResult: true },
        { role: "tool", content: "recent", isToolResult: true }
      ]
      const result = applyToolResultHygiene(history, {
        maxCumulativeToolResultTokens: 10_000,
        keepRecentToolResults: 1,
        maxToolResultTokens: 100
      })
      // The most recent tool result should be kept, older ones truncated
      expect(result.items[5].content).toBe("recent") // most recent, kept
      expect(result.truncatedCount).toBeGreaterThan(0)
    })
  })
})
