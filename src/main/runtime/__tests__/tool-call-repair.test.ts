import { describe, expect, it } from "vitest"
import { repairToolCallArguments } from "../tool-call-repair"

describe("tool-call-repair", () => {
  it("passes through simple arguments unchanged", () => {
    const result = repairToolCallArguments({ path: "/test", mode: "read" })
    expect(result.arguments).toEqual({ path: "/test", mode: "read" })
    expect(result.notes).toEqual([])
  })

  it("unwraps nested arguments wrapper", () => {
    const result = repairToolCallArguments({ arguments: { path: "/test" } })
    expect(result.arguments).toEqual({ path: "/test" })
    expect(result.notes).toContain("unwrapped arguments wrapper")
  })

  it("unwraps nested args wrapper", () => {
    const result = repairToolCallArguments({ args: { path: "/test" } })
    expect(result.arguments).toEqual({ path: "/test" })
    expect(result.notes).toContain("unwrapped args wrapper")
  })

  it("parses JSON string in wrapper", () => {
    const result = repairToolCallArguments({ arguments: '{"path":"/test"}' })
    expect(result.arguments).toEqual({ path: "/test" })
    expect(result.notes).toContain("parsed arguments JSON string")
  })

  it("truncates oversized strings", () => {
    const longString = "x".repeat(1000)
    const result = repairToolCallArguments(
      { content: longString },
      { maxStringBytes: 100 }
    )
    expect((result.arguments.content as string).length).toBeLessThan(longString.length)
    expect(result.notes.some(n => n.includes("truncated"))).toBe(true)
  })

  it("does not truncate small strings", () => {
    const result = repairToolCallArguments(
      { content: "short" },
      { maxStringBytes: 100 }
    )
    expect(result.arguments.content).toBe("short")
    expect(result.notes).toEqual([])
  })

  it("skips tool metadata keys when unwrapping", () => {
    const result = repairToolCallArguments({
      toolName: "read_file",
      callId: "123",
      arguments: { path: "/test" }
    })
    expect(result.arguments).toEqual({ path: "/test" })
  })
})
