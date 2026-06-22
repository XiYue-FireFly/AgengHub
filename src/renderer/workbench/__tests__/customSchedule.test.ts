import { describe, expect, it } from "vitest"
import { buildCustomScheduleTemplate, customScheduleHasRunnableSteps, normalizeStoredScheduleOverrides, sanitizeCustomSchedule } from "../customSchedule"

const baseSchedule: SchedulePreview = {
  preset: "custom",
  label: "Custom schedule",
  description: "test",
  steps: [
    { id: "custom-1", label: "Old Codex", agentId: "codex", role: "worker", mode: "auto" },
    { id: "custom-2", label: "Old Claude", agentId: "claude", role: "reviewer", mode: "auto", dependsOn: ["custom-1"] }
  ]
}

describe("custom schedule helpers", () => {
  it("does not build template steps when no local agents are usable", () => {
    expect(buildCustomScheduleTemplate("five", baseSchedule, [])).toBeNull()
    expect(buildCustomScheduleTemplate("parallel", baseSchedule, [])).toBeNull()
    expect(buildCustomScheduleTemplate("executor", baseSchedule, [])).toBeNull()
  })

  it("builds templates only from the supplied usable agent ids", () => {
    const schedule = buildCustomScheduleTemplate("five", baseSchedule, ["gemini"])!

    expect(schedule.steps).toHaveLength(5)
    expect(schedule.steps.every(step => step.agentId === "gemini")).toBe(true)
  })

  it("sanitizes stale or unavailable custom schedule agents before dispatch", () => {
    const sanitized = sanitizeCustomSchedule(baseSchedule, ["gemini"])

    expect(sanitized.steps.map(step => step.agentId)).toEqual(["gemini", "gemini"])
    expect(customScheduleHasRunnableSteps(sanitized)).toBe(true)
  })

  it("uses auto placeholders when no usable local agent exists", () => {
    const sanitized = sanitizeCustomSchedule(baseSchedule, [])

    expect(sanitized.steps.map(step => step.agentId)).toEqual(["auto", "auto"])
    expect(customScheduleHasRunnableSteps(sanitized)).toBe(false)
  })

  it("loads persisted schedule overrides for every non-legacy preset", () => {
    const overrides = normalizeStoredScheduleOverrides({
      "lead-workers": { ...baseSchedule, preset: "lead-workers" },
      broadcast: { ...baseSchedule, preset: "broadcast" },
      custom: baseSchedule,
      "firefly-custom": { ...baseSchedule, preset: "firefly-custom" },
      unknown: { ...baseSchedule, preset: "unknown" }
    })

    expect(overrides["lead-workers"]?.preset).toBe("lead-workers")
    expect(overrides.broadcast?.preset).toBe("broadcast")
    expect(overrides.custom).toBeUndefined()
    expect(overrides["firefly-custom"]).toBeUndefined()
    expect((overrides as any).unknown).toBeUndefined()
  })
})
