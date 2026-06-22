import { describe, expect, it } from "vitest"
import { healLoadedHistoryItems, isValidHistoryItem } from "../history-healing"

describe("history-healing", () => {
  describe("healLoadedHistoryItems", () => {
    it("returns unchanged when all items are valid", () => {
      const items = [
        { id: "1", role: "user", content: "hello" },
        { id: "2", role: "assistant", content: "hi" }
      ]
      const result = healLoadedHistoryItems(items)
      expect(result.changed).toBe(false)
      expect(result.items).toEqual(items)
    })

    it("assigns id to items without one", () => {
      const items = [
        { role: "user", content: "hello" },
        { id: "2", role: "assistant", content: "hi" }
      ]
      const result = healLoadedHistoryItems(items)
      expect(result.changed).toBe(true)
      expect(result.items[0].id).toContain("item_healed_0_user")
      expect(result.items[1].id).toBe("2")
    })

    it("normalizes role aliases", () => {
      const items = [
        { id: "1", role: "human", content: "hello" },
        { id: "2", role: "bot", content: "hi" },
        { id: "3", role: "ai", content: "hey" }
      ]
      const result = healLoadedHistoryItems(items)
      expect(result.changed).toBe(true)
      expect(result.items[0].role).toBe("user")
      expect(result.items[1].role).toBe("assistant")
      expect(result.items[2].role).toBe("assistant")
    })

    it("converts non-string content to string", () => {
      const items = [
        { id: "1", role: "user", content: 123 as any }
      ]
      const result = healLoadedHistoryItems(items)
      expect(result.changed).toBe(true)
      expect(result.items[0].content).toBe("123")
    })

    it("removes null/undefined items", () => {
      const items = [
        { id: "1", role: "user", content: "hello" },
        null as any,
        undefined as any,
        { id: "2", role: "assistant", content: "hi" }
      ]
      const result = healLoadedHistoryItems(items)
      expect(result.changed).toBe(true)
      expect(result.items.length).toBe(2)
    })
  })

  describe("isValidHistoryItem", () => {
    it("returns true for valid items", () => {
      expect(isValidHistoryItem({ role: "user", content: "hello" })).toBe(true)
      expect(isValidHistoryItem({ role: "assistant" })).toBe(true)
    })

    it("returns false for invalid items", () => {
      expect(isValidHistoryItem(null)).toBe(false)
      expect(isValidHistoryItem(undefined)).toBe(false)
      expect(isValidHistoryItem("string")).toBe(false)
      expect(isValidHistoryItem({ content: "no role" })).toBe(false)
    })
  })
})
