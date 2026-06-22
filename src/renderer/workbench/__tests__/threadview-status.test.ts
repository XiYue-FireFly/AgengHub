import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("ThreadView agent output status", () => {
  it("uses the latest agent lifecycle event instead of the first done event", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/ThreadView.tsx"), "utf8")

    expect(source).toContain("latestAgentStatus")
    expect(source).toContain("if (event.kind === 'agent:start') latestAgentStatus = 'running'")
    expect(source).toContain("done = event")
    expect(source).toContain("latestAgentStatus = 'completed'")
    expect(source).toContain("error = event")
    expect(source).toContain("latestAgentStatus = 'failed'")
    expect(source).toContain("if (eventsOrSummary.latestAgentStatus === 'running') return 'running'")
  })

  it("normalizes stream text while an agent is still running", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/ThreadView.tsx"), "utf8")

    expect(source).toContain("const text = normalizeOutput(rawText)")
    expect(source).not.toContain("status === 'running' ? rawText.trim()")
    expect(source).not.toContain("status === 'running' ? rawText : normalizeOutput(rawText)")
  })

  it("keeps run-only custom schedule output out of chat answer text", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/ThreadView.tsx"), "utf8")

    expect(source).toContain("event.payload?.visibility !== 'run'")
    expect(source).toContain("summary.done?.payload?.visibility === 'run' ? ''")
  })

  it("collapses tool streams after an agent finishes", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/ThreadView.tsx"), "utf8")

    expect(source).toContain("defaultOpen={status === 'running'}")
    expect(source).toContain("collapseWhenComplete")
  })

  it("uses raw event duration and counts failed agent runs in completion reports", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/ThreadView.tsx"), "utf8")

    expect(source).toContain("event.kind !== 'turn:created' && event.kind !== 'turn:status'")
    expect(source).not.toContain("event.kind !== 'run:created' && event.kind !== 'run:status'")
    expect(source).toContain("const failedRunCount = status === 'failed'")
    expect(source).toContain("totalTools: toolCalls.length + failedRunCount + successfulRunCount")
    expect(source).toContain("failedTools: toolCalls.filter(c => c.status === 'failed').length + failedRunCount")
    expect(source).toContain("totalDuration: eventDurationMs(events)")
    expect(source).toContain("function eventDurationMs(events: RuntimeEvent[]): number")
    expect(source).toContain("terminalEventTime(events)")
    expect(source).toContain("event.payload?.durationMs")
    expect(source).not.toContain("parseFloat(formatEventDuration(events))")
  })

  it("finalizes running tool rows and filters noisy URL fragments from modified files", () => {
    const source = readFileSync(join(process.cwd(), "src/renderer/workbench/ThreadView.tsx"), "utf8")

    expect(source).toContain("function stepsToToolCalls(steps: any[], runStatus: WorkbenchTurnStatus = 'running', terminalTime?: number)")
    expect(source).toContain("rawStatus === 'started' && runStatus === 'failed' ? 'failed'")
    expect(source).toContain("calls={stepsToToolCalls(summary.steps, status, terminalEventTime(agentEvents))}")
    expect(source).toContain("!isLikelySourceFilePath(parsed.path)")
    expect(source).toContain("function isLikelySourceFilePath(path: string): boolean")
    expect(source).toContain("/\\b[a-z][a-z0-9+.-]*:\\/\\//i.test(value)")
  })
})
