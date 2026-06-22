import { describe, expect, it } from "vitest"
import { ToolStormBreaker } from "../tool-storm-breaker"

describe("ToolStormBreaker", () => {
  it("allows first call", () => {
    const breaker = new ToolStormBreaker()
    const result = breaker.inspect("read_file", { path: "/test" })
    expect(result.suppress).toBe(false)
  })

  it("suppresses repeated identical calls", () => {
    const breaker = new ToolStormBreaker({ threshold: 3 })
    breaker.inspect("read_file", { path: "/test" })
    breaker.inspect("read_file", { path: "/test" })
    const result = breaker.inspect("read_file", { path: "/test" })
    expect(result.suppress).toBe(true)
    expect(result.reason).toContain("read_file")
    expect(result.reason).toContain("3 times")
  })

  it("allows different arguments", () => {
    const breaker = new ToolStormBreaker({ threshold: 3 })
    breaker.inspect("read_file", { path: "/test1" })
    breaker.inspect("read_file", { path: "/test2" })
    const result = breaker.inspect("read_file", { path: "/test3" })
    expect(result.suppress).toBe(false)
  })

  it("allows different tool names", () => {
    const breaker = new ToolStormBreaker({ threshold: 2 })
    breaker.inspect("read_file", { path: "/test" })
    breaker.inspect("write_file", { path: "/test" })
    const result = breaker.inspect("list_dir", { path: "/test" })
    expect(result.suppress).toBe(false)
  })

  it("exempts user_input tools", () => {
    const breaker = new ToolStormBreaker({ threshold: 2 })
    breaker.inspect("request_user_input", { prompt: "?" })
    breaker.inspect("request_user_input", { prompt: "?" })
    const result = breaker.inspect("request_user_input", { prompt: "?" })
    expect(result.suppress).toBe(false)
  })

  it("resets on new turn", () => {
    const breaker = new ToolStormBreaker({ threshold: 2 })
    breaker.inspect("read_file", { path: "/test" })
    breaker.reset()
    const result = breaker.inspect("read_file", { path: "/test" })
    expect(result.suppress).toBe(false)
  })

  it("tracks size correctly", () => {
    const breaker = new ToolStormBreaker()
    expect(breaker.size()).toBe(0)
    breaker.inspect("tool1", {})
    expect(breaker.size()).toBe(1)
    breaker.inspect("tool2", {})
    expect(breaker.size()).toBe(2)
  })

  it("respects window size", () => {
    const breaker = new ToolStormBreaker({ windowSize: 2, threshold: 3 })
    breaker.inspect("tool1", { a: 1 })
    breaker.inspect("tool2", { a: 2 })
    breaker.inspect("tool3", { a: 3 })
    expect(breaker.size()).toBe(2) // window size limit
  })
})
