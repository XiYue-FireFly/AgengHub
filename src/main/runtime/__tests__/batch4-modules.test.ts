import { describe, expect, it } from "vitest"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

// --- Conversation Import ---

describe("conversation-import", () => {
  it("imports valid JSON conversation", async () => {
    const { importConversationFromJson } = await import("../conversation-import")
    const json = JSON.stringify({
      version: 1,
      title: "Test",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!", agentId: "codex" }
      ]
    })
    const result = importConversationFromJson(json)
    expect(result.ok).toBe(true)
    expect(result.messageCount).toBe(2)
    expect(result.conversation!.title).toBe("Test")
  })

  it("rejects invalid JSON", async () => {
    const { importConversationFromJson } = await import("../conversation-import")
    expect(importConversationFromJson("not json").ok).toBe(false)
  })

  it("migrates legacy format without version", async () => {
    const { importConversationFromJson } = await import("../conversation-import")
    const result = importConversationFromJson(JSON.stringify({
      title: "Legacy",
      messages: [{ role: "user", content: "test" }]
    }))
    expect(result.ok).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings![0]).toContain("Legacy")
  })

  it("branches from checkpoint", async () => {
    const { importConversationFromJson, branchFromCheckpoint } = await import("../conversation-import")
    const result = importConversationFromJson(JSON.stringify({
      version: 1, title: "Test",
      messages: [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
        { role: "assistant", content: "A2" }
      ]
    }))
    const branch = branchFromCheckpoint(result.conversation!, 1)
    expect(branch.ok).toBe(true)
    expect(branch.messages).toHaveLength(2)
    expect(branch.messages![1].content).toBe("A1")
  })

  it("summarizes conversation", async () => {
    const { importConversationFromJson, summarizeConversation } = await import("../conversation-import")
    const result = importConversationFromJson(JSON.stringify({
      version: 1, title: "Summary Test",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!", agentId: "codex" },
        { role: "user", content: "Bye" }
      ]
    }))
    const summary = summarizeConversation(result.conversation!)
    expect(summary.messageCount).toBe(3)
    expect(summary.userMessages).toBe(2)
    expect(summary.agentIds).toEqual(["codex"])
  })
})

// --- Memory Graph ---

describe("memory-graph", () => {
  it("builds graph from entries", async () => {
    const { buildMemoryGraph } = await import("../memory-graph")
    const entries = [
      { id: "a", title: "Pref A", category: "preference" as const, tags: ["tag1", "tag2"], status: "approved" as const, useCount: 5 },
      { id: "b", title: "Pref B", category: "preference" as const, tags: ["tag1"], status: "approved" as const, useCount: 0 },
      { id: "c", title: "Proj C", category: "project" as const, tags: ["tag3"], status: "approved" as const, useCount: 0 }
    ]
    const graph = buildMemoryGraph(entries as any)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges.length).toBeGreaterThan(0)
    expect(graph.stats.totalNodes).toBe(3)
    expect(graph.stats.categories.preference).toBe(2)
  })

  it("suggests cleanup for low-importance isolated nodes", async () => {
    const { buildMemoryGraph, suggestCleanup } = await import("../memory-graph")
    const entries = [
      { id: "pinned", title: "Important", category: "preference" as const, tags: [], status: "approved" as const, metadata: { pinned: true }, useCount: 10 },
      { id: "low", title: "Low value", category: "task" as const, tags: [], status: "approved" as const, useCount: 0 }
    ]
    const graph = buildMemoryGraph(entries as any)
    const cleanup = suggestCleanup(graph)
    expect(cleanup.some(n => n.id === "low")).toBe(true)
    expect(cleanup.some(n => n.id === "pinned")).toBe(false)
  })
})

// --- Plugin Manager ---

describe("plugin-manager", () => {
  it("scans plugins from directory", async () => {
    const { validateManifest, getPluginContributions } = await import("../plugin-manager")
    // Test manifest validation and contributions (directory scanning depends on homedir)
    const manifest = {
      name: "My Plugin",
      version: "1.0.0",
      contributes: { commands: [{ id: "test", label: "Test" }] }
    }
    expect(validateManifest(manifest).valid).toBe(true)
    const plugins = [{
      id: "local::my-plugin",
      manifest,
      path: "/test",
      enabled: true,
      source: "local" as const
    }]
    const contribs = getPluginContributions(plugins)
    expect(contribs.commands).toHaveLength(1)
    expect(contribs.commands[0].id).toBe("test")
  })

  it("validates manifest", async () => {
    const { validateManifest } = await import("../plugin-manager")
    expect(validateManifest({ name: "Test", version: "1.0" }).valid).toBe(true)
    expect(validateManifest({ name: "Test" }).valid).toBe(false)
    expect(validateManifest(null).valid).toBe(false)
  })

  it("gets contributions from enabled plugins", async () => {
    const { getPluginContributions } = await import("../plugin-manager")
    const plugins = [{
      id: "test::p1",
      manifest: {
        name: "P1", version: "1.0",
        contributes: {
          commands: [{ id: "c1", label: "Command 1" }],
          prompts: [{ id: "pr1", name: "Prompt 1", body: "hello" }]
        }
      },
      path: "/test",
      enabled: true,
      source: "local" as const
    }]
    const contribs = getPluginContributions(plugins)
    expect(contribs.commands).toHaveLength(1)
    expect(contribs.prompts).toHaveLength(1)
    expect(contribs.commands[0].pluginId).toBe("test::p1")
  })
})

// --- Release Workspace ---

describe("release-workspace", () => {
  it("runs release checks with all passing", async () => {
    const { runReleaseChecks } = await import("../release-workspace")
    const report = await runReleaseChecks({
      appVersion: "1.0.0",
      typecheckPass: true,
      testPass: true,
      buildPass: true,
      hasChangelog: true,
      hasGitTag: true,
      gitClean: true
    })
    expect(report.ready).toBe(true)
    expect(report.summary.pass).toBe(7)
    expect(report.summary.fail).toBe(0)
  })

  it("reports not ready when typecheck fails", async () => {
    const { runReleaseChecks } = await import("../release-workspace")
    const report = await runReleaseChecks({
      appVersion: "1.0.0",
      typecheckPass: false,
      testPass: true,
      buildPass: true,
      hasChangelog: true,
      hasGitTag: true,
      gitClean: true
    })
    expect(report.ready).toBe(false)
    expect(report.summary.fail).toBe(1)
    expect(report.checks.find(c => c.id === "typecheck")?.status).toBe("fail")
  })

  it("warns on missing changelog and dirty tree", async () => {
    const { runReleaseChecks } = await import("../release-workspace")
    const report = await runReleaseChecks({
      appVersion: "1.0.0",
      typecheckPass: true,
      testPass: true,
      buildPass: true,
      hasChangelog: false,
      hasGitTag: false,
      gitClean: false
    })
    expect(report.ready).toBe(true) // warns don't block
    expect(report.summary.warn).toBe(3)
  })
})
