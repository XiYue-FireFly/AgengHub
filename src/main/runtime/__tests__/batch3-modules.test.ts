import { describe, expect, it, vi, beforeEach } from "vitest"

const memory: Record<string, any> = {}
vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  }
}))

describe("project-knowledge", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it("creates and retrieves knowledge entries", async () => {
    const { upsertKnowledge, getKnowledge } = await import("../project-knowledge")
    const entry = upsertKnowledge({ title: "Build Command", content: "npm run build", category: "build", tags: ["npm"] })
    expect(entry.title).toBe("Build Command")
    expect(getKnowledge(entry.id)?.content).toBe("npm run build")
  })

  it("filters by workspace and category", async () => {
    const { upsertKnowledge, listKnowledge } = await import("../project-knowledge")
    upsertKnowledge({ title: "A", content: "a", category: "architecture", workspaceId: "ws1" })
    upsertKnowledge({ title: "B", content: "b", category: "build", workspaceId: "ws1" })
    upsertKnowledge({ title: "C", content: "c", category: "architecture", workspaceId: null })
    expect(listKnowledge("ws1")).toHaveLength(3) // ws1 entries + global (null) entries
    expect(listKnowledge("ws1", "architecture")).toHaveLength(2) // A (ws1) + C (null)
    expect(listKnowledge(null, "architecture")).toHaveLength(1) // only global
    expect(listKnowledge(undefined, "architecture")).toHaveLength(2) // all workspaces
  })

  it("searches by title, content, and tags", async () => {
    const { upsertKnowledge, searchKnowledge } = await import("../project-knowledge")
    upsertKnowledge({ title: "Architecture", content: "Uses hexagonal ports", tags: ["arch"] })
    upsertKnowledge({ title: "Build", content: "npm run build", tags: ["npm"] })
    expect(searchKnowledge("hexagonal")).toHaveLength(1)
    expect(searchKnowledge("npm")).toHaveLength(1)
    expect(searchKnowledge("arch")).toHaveLength(1)
  })

  it("deletes entries", async () => {
    const { upsertKnowledge, deleteKnowledge, getKnowledge } = await import("../project-knowledge")
    const e = upsertKnowledge({ title: "Delete Me", content: "temp" })
    expect(deleteKnowledge(e.id)).toBe(true)
    expect(getKnowledge(e.id)).toBeNull()
  })
})

describe("keyboard-shortcuts", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it("has default shortcuts on first run", async () => {
    const { listShortcuts } = await import("../keyboard-shortcuts")
    const all = listShortcuts()
    expect(all.length).toBeGreaterThanOrEqual(10)
    expect(all.some(s => s.id === 'focus-composer')).toBe(true)
    expect(all.some(s => s.id === 'new-conversation')).toBe(true)
  })

  it("updates a shortcut key", async () => {
    const { updateShortcut, getShortcut } = await import("../keyboard-shortcuts")
    const updated = updateShortcut('focus-composer', 'Ctrl+J')
    expect(updated?.key).toBe('Ctrl+J')
    expect(getShortcut('focus-composer')?.key).toBe('Ctrl+J')
  })

  it("resets a shortcut to default", async () => {
    const { updateShortcut, resetShortcut, getShortcut } = await import("../keyboard-shortcuts")
    updateShortcut('focus-composer', 'Ctrl+J')
    resetShortcut('focus-composer')
    expect(getShortcut('focus-composer')?.key).toBe('Ctrl+L') // default
  })

  it("detects conflicts", async () => {
    const { updateShortcut, detectConflicts } = await import("../keyboard-shortcuts")
    updateShortcut('focus-composer', 'Ctrl+N') // same as new-conversation
    const conflicts = detectConflicts()
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts.some(c => c.key === 'Ctrl+N')).toBe(true)
  })

  it("filters by category", async () => {
    const { listShortcuts } = await import("../keyboard-shortcuts")
    const nav = listShortcuts('navigation')
    expect(nav.length).toBeGreaterThan(0)
    expect(nav.every(s => s.category === 'navigation')).toBe(true)
  })
})
