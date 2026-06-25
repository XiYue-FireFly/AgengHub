import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("Workbench runtime event loading", () => {
  it("merges live runtime events that arrive while a snapshot is loading", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/WorkbenchLayout.tsx"), "utf8")

    expect(source).toContain("function mergeRuntimeEventLists")
    expect(source).toContain("setEvents(prev => mergeRuntimeEventLists(prev, nextEvents))")
    expect(source).toContain("const loadedEvents = await window.electronAPI.runtime.eventsSince")
    expect(source).toContain("...prev.filter(event => event.threadId === nextVisibleThreadId)")
    expect(source).toContain("...pendingRuntimeEvents.current.filter(event => event.threadId === nextVisibleThreadId)")
    expect(source).toContain("const pendingForSelected = selected ? pendingRuntimeEvents.current.filter(event => event.threadId === selected)")
    expect(source).toContain("...prev.filter(event => event.threadId === selected)")
    expect(source).toContain("...pendingForSelected")
    expect(source).not.toContain("setEvents(await window.electronAPI.runtime.eventsSince")
  })

  it("flushes the first visible stream delta immediately before batching later deltas", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/WorkbenchLayout.tsx"), "utf8")

    expect(source).toContain("seenImmediateStreamKeys")
    expect(source).toContain("shouldFlushFirstStreamDelta(event, seenImmediateStreamKeys.current)")
    expect(source).toContain("appendRuntimeEvents([event])")
    expect(source).toContain("event.kind !== 'agent:delta' || event.payload?.channel === 'thinking'")
    expect(source).toContain("seenKeys.add(key)")
    expect(source).toContain("seenImmediateStreamKeys.current.clear()")
  })

  it("captures live events for the thread currently being loaded or selected", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/WorkbenchLayout.tsx"), "utf8")

    expect(source).toContain("loadingThreadIdRef")
    expect(source).toContain("loadingThreadIdRef.current = threadId")
    expect(source).toContain("const isPendingThreadEvent = pendingActiveThreadId !== null && event.threadId === loadingThreadIdRef.current")
    expect(source).toContain("const isVisibleThreadEvent = event.threadId === selectedThreadIdRef.current")
    expect(source).toContain("if (pendingActiveThreadId) {")
    expect(source).toContain("if (selectThreadGenRef.current === gen) {")
  })
})
