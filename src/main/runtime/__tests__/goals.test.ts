import { beforeEach, describe, expect, it, vi } from "vitest"

const memory: Record<string, any> = {}

vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  }
}))

describe("workbench goals", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it("sets, reads, and clears thread goals", async () => {
    const { clearWorkbenchGoal, getWorkbenchGoal, setWorkbenchGoal } = await import("../goals")

    const goal = setWorkbenchGoal("thread-1", "Ship the release", 7)
    expect(goal).toMatchObject({ threadId: "thread-1", goal: "Ship the release", loopLimit: 7, status: "active" })
    expect(getWorkbenchGoal("thread-1")?.goal).toBe("Ship the release")

    clearWorkbenchGoal("thread-1")
    expect(getWorkbenchGoal("thread-1")).toBeNull()
  })

  it("parses loop limit with conservative clamping", async () => {
    const { parseLoopLimit } = await import("../goals")

    expect(parseLoopLimit("--limit 3", 5)).toBe(3)
    expect(parseLoopLimit("--times=99", 5)).toBe(20)
    expect(parseLoopLimit("", 4)).toBe(4)
  })

  it("wraps normal prompts with active goal context", async () => {
    const { promptWithGoalContext, setWorkbenchGoal } = await import("../goals")

    const goal = setWorkbenchGoal("thread-1", "Ship the release", 7)
    const wrapped = promptWithGoalContext("Fix the failing test", goal)

    expect(wrapped).toContain("[AgentHub Thread Goal]")
    expect(wrapped).toContain("Ship the release")
    expect(wrapped).toContain("[Current User Request]")
    expect(wrapped).toContain("Fix the failing test")
  })

  it("does not wrap loop or goal command prompts", async () => {
    const { promptWithGoalContext, setWorkbenchGoal } = await import("../goals")

    const goal = setWorkbenchGoal("thread-1", "Ship the release", 7)

    expect(promptWithGoalContext("[AgentHub Loop]\nGoal: Ship", goal)).toBe("[AgentHub Loop]\nGoal: Ship")
    expect(promptWithGoalContext("/goal rewrite this", goal)).toBe("/goal rewrite this")
    expect(promptWithGoalContext("/loop --limit 3", goal)).toBe("/loop --limit 3")
  })
})
