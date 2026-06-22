import { describe, expect, it } from "vitest"
import { AppendOnlySessionLog, type SessionEvent } from "../append-only-session-log"

describe("AppendOnlySessionLog", () => {
  function makeEvent(id: string, timestamp: number): SessionEvent {
    return { id, kind: "test", threadId: "t1", turnId: "turn1", timestamp }
  }

  it("starts empty", () => {
    const log = new AppendOnlySessionLog()
    expect(log.size()).toBe(0)
    expect(log.getEvents()).toEqual([])
    expect(log.last()).toBeUndefined()
  })

  it("appends events", () => {
    const log = new AppendOnlySessionLog()
    log.append(makeEvent("1", 100))
    log.append(makeEvent("2", 200))
    expect(log.size()).toBe(2)
    expect(log.last()?.id).toBe("2")
  })

  it("gets events since timestamp", () => {
    const log = new AppendOnlySessionLog()
    log.append(makeEvent("1", 100))
    log.append(makeEvent("2", 200))
    log.append(makeEvent("3", 300))
    const recent = log.getEventsSince(150)
    expect(recent.length).toBe(2)
    expect(recent[0].id).toBe("2")
    expect(recent[1].id).toBe("3")
  })

  it("evicts old events when window size exceeded", () => {
    const log = new AppendOnlySessionLog(3)
    log.append(makeEvent("1", 100))
    log.append(makeEvent("2", 200))
    log.append(makeEvent("3", 300))
    log.append(makeEvent("4", 400))
    expect(log.size()).toBe(3)
    expect(log.getEvents()[0].id).toBe("2")
    expect(log.last()?.id).toBe("4")
  })

  it("clears all events", () => {
    const log = new AppendOnlySessionLog()
    log.append(makeEvent("1", 100))
    log.clear()
    expect(log.size()).toBe(0)
  })

  it("returns copy of events array", () => {
    const log = new AppendOnlySessionLog()
    log.append(makeEvent("1", 100))
    const events = log.getEvents()
    events.push(makeEvent("2", 200))
    expect(log.size()).toBe(1) // original not modified
  })
})
