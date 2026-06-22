import { describe, expect, it } from "vitest"
import { ContextEstimator, defaultEstimator } from "../context-estimator"

describe("ContextEstimator", () => {
  describe("estimateText", () => {
    it("returns 0 for empty string", () => {
      const estimator = new ContextEstimator()
      expect(estimator.estimateText("")).toBe(0)
      expect(estimator.estimateText(null as any)).toBe(0)
    })

    it("estimates ASCII text at ~4 chars per token", () => {
      const estimator = new ContextEstimator()
      expect(estimator.estimateText("hello")).toBe(2) // 5/4 = 1.25 -> 2
      expect(estimator.estimateText("a".repeat(16))).toBe(4) // 16/4 = 4
    })

    it("estimates CJK text at ~1 token per character", () => {
      const estimator = new ContextEstimator()
      expect(estimator.estimateText("你好世界")).toBe(4)
      expect(estimator.estimateText("テスト")).toBe(3)
    })

    it("handles mixed ASCII and CJK", () => {
      const estimator = new ContextEstimator()
      // "hello" = 5 chars -> 2 tokens, "你好" = 2 tokens, "world" = 5 chars -> 2 tokens, "世界" = 2 tokens
      expect(estimator.estimateText("hello你好world世界")).toBe(8)
    })

    it("ignores combining marks", () => {
      const estimator = new ContextEstimator()
      // e + combining acute accent (U+0301) should count as 1 token, not 2
      expect(estimator.estimateText("é")).toBe(1)
    })
  })

  describe("estimateItems", () => {
    it("estimates array of items", () => {
      const estimator = new ContextEstimator()
      const items = [
        { text: "hello" },
        { content: "你好" }
      ]
      // "hello" = 2 tokens, "你好" = 2 tokens
      expect(estimator.estimateItems(items)).toBe(4)
    })
  })

  describe("estimateTool", () => {
    it("estimates tool spec tokens", () => {
      const estimator = new ContextEstimator()
      const tool = { name: "read_file", description: "Read a file from disk", inputSchema: { path: "string" } }
      const tokens = estimator.estimateTool(tool)
      expect(tokens).toBeGreaterThan(0)
    })
  })

  describe("defaultEstimator", () => {
    it("is a singleton instance", () => {
      expect(defaultEstimator).toBeInstanceOf(ContextEstimator)
      expect(defaultEstimator.estimateText("test")).toBeGreaterThan(0)
    })
  })
})
