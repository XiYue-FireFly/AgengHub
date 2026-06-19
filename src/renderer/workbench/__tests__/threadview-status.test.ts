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
})
