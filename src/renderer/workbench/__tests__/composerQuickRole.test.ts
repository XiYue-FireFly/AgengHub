import { describe, expect, it } from "vitest"
import { pickAgentForRole, quickRoleSchedule, quickRoleSendOverrides } from "../ComposerBar"

describe("Composer quick child-agent schedules", () => {
  it("does not fall back to hardcoded local agents when none are usable", () => {
    expect(pickAgentForRole("reviewer", [])).toBeNull()
    expect(quickRoleSchedule("executor", [])).toBeNull()
  })

  it("uses only supplied usable local agents", () => {
    expect(pickAgentForRole("executor", ["gemini"])).toBe("gemini")

    const schedule = quickRoleSchedule("gatekeeper", ["gemini"])!
    expect(schedule.steps).toHaveLength(1)
    expect(schedule.steps[0].agentId).toBe("gemini")
    expect(schedule.labelZh).toBe("快速门禁")
    expect(schedule.steps[0].labelZh).toBe("快速门禁")
  })

  it("adds a concrete guard dependency before quick executor dispatch", () => {
    const schedule = quickRoleSchedule("executor", ["gemini"])!

    expect(schedule.steps.map(step => step.id)).toEqual(["quick-reviewer", "quick-executor"])
    expect(schedule.steps.every(step => step.agentId === "gemini")).toBe(true)
    expect(schedule.steps[0]).toMatchObject({ role: "reviewer" })
    expect(schedule.steps[1]).toMatchObject({ role: "executor", dependsOn: ["quick-reviewer"] })
    expect(schedule.descriptionZh).toBe("本轮临时先审查，再派发一个执行子 Agent。")
  })

  it("clears provider model selection when dispatching a quick child agent", () => {
    const schedule = quickRoleSchedule("reviewer", ["claude"])!
    expect(quickRoleSendOverrides(schedule)).toMatchObject({
      mode: "custom",
      targetAgent: null,
      customSchedule: schedule,
      modelSelection: null
    })
  })
})
