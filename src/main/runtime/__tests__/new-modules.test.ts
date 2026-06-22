import { describe, expect, it, vi, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readFile, rm } from "node:fs/promises"

const memory: Record<string, any> = {}
vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  }
}))

// --- Conversation Export ---

describe("conversation-export", () => {
  it("formats as markdown with tool calls folded", async () => {
    const { formatAsMarkdown } = await import("../conversation-export")
    const md = formatAsMarkdown({
      version: 1,
      title: "Test Session",
      exportedAt: "2026-01-01",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!", agentId: "codex",
          thinking: "Let me think...", toolCalls: [{ name: "fs_read", args: '{"path":"/test"}', result: "file content" }] }
      ]
    })
    expect(md).toContain("# Test Session")
    expect(md).toContain("**User**")
    expect(md).toContain("**Assistant** (codex)")
    expect(md).toContain("<details><summary>Thinking</summary>")
    expect(md).toContain("<details><summary>Tool: fs_read</summary>")
    expect(md).toContain("file content")
  })

  it("formats as HTML with proper escaping", async () => {
    const { formatAsHtml } = await import("../conversation-export")
    const html = formatAsHtml({
      version: 1,
      title: "Test <script>",
      exportedAt: "2026-01-01",
      messages: [{ role: "user", content: "Hello & goodbye" }]
    })
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("Hello &amp; goodbye")
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("msg-user")
  })

  it("exports to file", async () => {
    const { exportConversation } = await import("../conversation-export")
    const tmpFile = join(tmpdir(), `agenthub-export-test-${Date.now()}.md`)
    const result = await exportConversation({
      version: 1, title: "Export Test", exportedAt: "2026-01-01",
      messages: [{ role: "user", content: "test" }]
    }, "markdown", tmpFile)
    expect(result.ok).toBe(true)
    const content = await readFile(tmpFile, "utf-8")
    expect(content).toContain("# Export Test")
    await rm(tmpFile, { force: true })
  })
})

// --- Notifications ---

describe("notifications", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it("pushes and lists notifications", async () => {
    const { pushNotification, listNotifications } = await import("../notifications")
    pushNotification({ title: "Task done", body: "Build completed", category: "task" })
    pushNotification({ title: "MCP down", body: "Server unreachable", category: "mcp" })
    const all = listNotifications()
    expect(all).toHaveLength(2)
    expect(all[0].title).toBe("MCP down") // newest first
  })

  it("tracks unread count", async () => {
    const { pushNotification, getUnreadCount, markRead, markAllRead } = await import("../notifications")
    const n1 = pushNotification({ title: "A", body: "a", category: "system" })
    pushNotification({ title: "B", body: "b", category: "system" })
    expect(getUnreadCount()).toBe(2)
    markRead(n1.id)
    expect(getUnreadCount()).toBe(1)
    markAllRead()
    expect(getUnreadCount()).toBe(0)
  })

  it("filters unread only", async () => {
    const { pushNotification, listNotifications, markRead } = await import("../notifications")
    const n = pushNotification({ title: "Read me", body: "x", category: "system" })
    pushNotification({ title: "Unread", body: "y", category: "system" })
    markRead(n.id)
    expect(listNotifications(true)).toHaveLength(1)
    expect(listNotifications(true)[0].title).toBe("Unread")
  })

  it("deletes and clears notifications", async () => {
    const { pushNotification, deleteNotification, clearAllNotifications, listNotifications } = await import("../notifications")
    const n = pushNotification({ title: "Temp", body: "x", category: "system" })
    expect(deleteNotification(n.id)).toBe(true)
    pushNotification({ title: "A", body: "a", category: "system" })
    pushNotification({ title: "B", body: "b", category: "system" })
    clearAllNotifications()
    expect(listNotifications()).toHaveLength(0)
  })
})

// --- Onboarding ---

describe("onboarding", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it("shows onboarding on first run", async () => {
    const { shouldShowOnboarding } = await import("../onboarding")
    expect(shouldShowOnboarding()).toBe(true)
  })

  it("completes steps and advances", async () => {
    const { completeStep, getNextStep, getOnboardingState } = await import("../onboarding")
    expect(getNextStep()).toBe("select-language")
    completeStep("select-language")
    expect(getNextStep()).toBe("bind-provider")
    expect(getOnboardingState().completedSteps).toContain("select-language")
  })

  it("marks onboarding complete when all steps done", async () => {
    const { completeStep, shouldShowOnboarding } = await import("../onboarding")
    const steps = ["select-language", "bind-provider", "detect-agents", "choose-default-agent", "test-mcp", "enable-skills", "create-workspace", "send-first-message"] as const
    for (const step of steps) completeStep(step)
    expect(shouldShowOnboarding()).toBe(false)
  })

  it("skip all marks complete immediately", async () => {
    const { skipAllOnboarding, shouldShowOnboarding, getOnboardingState } = await import("../onboarding")
    skipAllOnboarding()
    expect(shouldShowOnboarding()).toBe(false)
    expect(getOnboardingState().skippedSteps.length).toBe(8)
  })

  it("reset brings back onboarding", async () => {
    const { skipAllOnboarding, resetOnboarding, shouldShowOnboarding } = await import("../onboarding")
    skipAllOnboarding()
    expect(shouldShowOnboarding()).toBe(false)
    resetOnboarding()
    expect(shouldShowOnboarding()).toBe(true)
  })

  it("tracks skipped steps separately", async () => {
    const { completeStep, getOnboardingState } = await import("../onboarding")
    completeStep("test-mcp", true) // skipped
    const state = getOnboardingState()
    expect(state.skippedSteps).toContain("test-mcp")
    expect(state.completedSteps).toContain("test-mcp")
  })
})
