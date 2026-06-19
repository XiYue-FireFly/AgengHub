import { describe, expect, it } from "vitest"
import { fireflyFiveRoleTemplate, listSchedules, previewSchedule, toDispatcherMode } from "../schedules"

describe("runtime schedules", () => {
  it("includes an editable custom schedule preset", () => {
    const custom = previewSchedule("custom")

    expect(listSchedules().some(schedule => schedule.preset === "custom")).toBe(true)
    expect(custom.label).toBe("Custom schedule")
    expect(custom.steps[0].agentId).toBe("auto")
  })

  it("includes the smart five-role preset", () => {
    const schedule = previewSchedule("firefly-custom")

    expect(schedule.preset).toBe("firefly-custom")
    expect(schedule.label).toBe("Smart five-role")
    expect(schedule.labelZh).toBe("智能五角色")
    expect(schedule.steps.map(step => step.role)).toEqual(["router", "lead", "reviewer", "executor", "gatekeeper"])
    expect(schedule.steps.find(step => step.id === "router")?.dependsOn).toBeUndefined()
    expect(schedule.steps.find(step => step.id === "main")?.dependsOn).toEqual(["router"])
    expect(schedule.steps.find(step => step.id === "executor")?.dependsOn).toEqual(["reviewer"])
    expect(schedule.steps.find(step => step.id === "gatekeeper")?.dependsOn).toEqual(["executor"])
  })

  it("builds five-role templates from available agents", () => {
    const schedule = fireflyFiveRoleTemplate(["gemini", "codex"])

    expect(schedule.steps).toHaveLength(5)
    expect(schedule.steps.every(step => ["gemini", "codex"].includes(step.agentId))).toBe(true)
  })

  it("reuses one usable agent across every five-role step instead of falling back to auto", () => {
    const schedule = fireflyFiveRoleTemplate(["codex"])

    expect(schedule.steps).toHaveLength(5)
    expect(schedule.steps.every(step => step.agentId === "codex")).toBe(true)
  })

  it("does not fabricate local agents when no available agents are supplied", () => {
    const schedule = fireflyFiveRoleTemplate([])

    expect(schedule.steps).toHaveLength(5)
    expect(schedule.steps.every(step => step.agentId === "auto")).toBe(true)
  })

  it("maps custom schedules to a safe dispatcher fallback", () => {
    expect(toDispatcherMode("custom")).toBe("chain")
    expect(toDispatcherMode("firefly-custom")).toBe("chain")
  })
})
