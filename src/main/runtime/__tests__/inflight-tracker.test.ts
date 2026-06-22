import { describe, expect, it } from "vitest"
import { InflightTracker } from "../inflight-tracker"

describe("InflightTracker", () => {
  it("starts empty", () => {
    const tracker = new InflightTracker()
    expect(tracker.size()).toBe(0)
    expect(tracker.list()).toEqual([])
    expect(tracker.has("x")).toBe(false)
  })

  it("begins and ends tracking", () => {
    const tracker = new InflightTracker()
    const record = tracker.begin({ id: "1", kind: "model", threadId: "t1" })
    expect(record.id).toBe("1")
    expect(record.startedAt).toBeGreaterThan(0)
    expect(tracker.has("1")).toBe(true)
    expect(tracker.size()).toBe(1)

    const ended = tracker.end("1")
    expect(ended?.id).toBe("1")
    expect(tracker.has("1")).toBe(false)
    expect(tracker.size()).toBe(0)
  })

  it("returns undefined when ending unknown id", () => {
    const tracker = new InflightTracker()
    expect(tracker.end("unknown")).toBeUndefined()
  })

  it("run guarantees cleanup on success", async () => {
    const tracker = new InflightTracker()
    const result = await tracker.run(
      { id: "1", kind: "tool", threadId: "t1" },
      async () => "result"
    )
    expect(result).toBe("result")
    expect(tracker.has("1")).toBe(false)
  })

  it("run guarantees cleanup on error", async () => {
    const tracker = new InflightTracker()
    try {
      await tracker.run(
        { id: "1", kind: "tool", threadId: "t1" },
        async () => { throw new Error("fail") }
      )
    } catch {
      // expected
    }
    expect(tracker.has("1")).toBe(false)
  })

  it("lists all inflight records", () => {
    const tracker = new InflightTracker()
    tracker.begin({ id: "1", kind: "model", threadId: "t1" })
    tracker.begin({ id: "2", kind: "tool", threadId: "t1" })
    const list = tracker.list()
    expect(list.length).toBe(2)
  })

  it("clears all entries", () => {
    const tracker = new InflightTracker()
    tracker.begin({ id: "1", kind: "model", threadId: "t1" })
    tracker.begin({ id: "2", kind: "tool", threadId: "t1" })
    tracker.clear()
    expect(tracker.size()).toBe(0)
  })
})
