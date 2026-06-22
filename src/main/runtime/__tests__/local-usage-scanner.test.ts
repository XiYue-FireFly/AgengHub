import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

let testHome = ""

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os")
  return { ...actual, homedir: () => testHome || actual.homedir() }
})

// Dynamic import to ensure mock is applied before module loads
let scanClaudeLocalUsage: typeof import("../local-usage-scanner").scanClaudeLocalUsage

describe("local-usage-scanner", () => {
  beforeEach(async () => {
    testHome = mkdtempSync(join(tmpdir(), "agenthub-test-home-"))
    const mod = await import("../local-usage-scanner")
    scanClaudeLocalUsage = mod.scanClaudeLocalUsage
  })
  afterEach(() => {
    testHome = ""
  })

  it("returns empty result when ~/.claude/projects does not exist", () => {
    const result = scanClaudeLocalUsage(7)
    expect(result.records).toEqual([])
    expect(result.diagnostics.errors.length).toBeGreaterThan(0)
  })

  it("scans Claude JSONL files and extracts usage records", () => {
    const projectsDir = join(testHome, ".claude", "projects")
    const projectDir = join(projectsDir, "test-project")
    mkdirSync(projectDir, { recursive: true })

    const jsonl = [
      JSON.stringify({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          model: "claude-sonnet-4-6",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 20,
            cache_creation_input_tokens: 10
          }
        }
      }),
      JSON.stringify({
        type: "user",
        timestamp: Date.now(),
        message: { content: "hello" }
      }),
      JSON.stringify({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          model: "claude-opus-4-8",
          usage: {
            input_tokens: 200,
            output_tokens: 100,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0
          }
        }
      })
    ].join("\n")

    writeFileSync(join(projectDir, "session.jsonl"), jsonl)

    const result = scanClaudeLocalUsage(7)

    expect(result.records.length).toBe(2)
    expect(result.records.every(r => r.source === "local-claude-session")).toBe(true)
    const sonnet = result.records.find(r => r.modelId === "claude-sonnet-4-6")!
    const opus = result.records.find(r => r.modelId === "claude-opus-4-8")!
    expect(sonnet.inputTokens).toBe(100)
    expect(sonnet.cacheReadTokens).toBe(20)
    expect(opus.inputTokens).toBe(200)
    expect(opus.outputTokens).toBe(100)
    expect(result.diagnostics.scannedFiles).toBe(1)
    expect(result.diagnostics.parsedRecords).toBe(2)
    expect(result.diagnostics.errors).toEqual([])
  })

  it("skips agent-* subagent session files", () => {
    const projectsDir = join(testHome, ".claude", "projects")
    const projectDir = join(projectsDir, "test-project")
    mkdirSync(projectDir, { recursive: true })

    const jsonl = JSON.stringify({
      type: "assistant",
      timestamp: Date.now(),
      message: {
        model: "claude-sonnet-4-6",
        usage: { input_tokens: 100, output_tokens: 50 }
      }
    })

    writeFileSync(join(projectDir, "session.jsonl"), jsonl)
    writeFileSync(join(projectDir, "agent-subtask.jsonl"), jsonl)

    const result = scanClaudeLocalUsage(7)

    expect(result.records.length).toBe(1)
    expect(result.diagnostics.scannedFiles).toBe(1)
  })

  it("skips records with no meaningful usage", () => {
    const projectsDir = join(testHome, ".claude", "projects")
    const projectDir = join(projectsDir, "test-project")
    mkdirSync(projectDir, { recursive: true })

    const jsonl = JSON.stringify({
      type: "assistant",
      timestamp: Date.now(),
      message: {
        model: "claude-sonnet-4-6",
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    })

    writeFileSync(join(projectDir, "session.jsonl"), jsonl)

    const result = scanClaudeLocalUsage(7)

    expect(result.records.length).toBe(0)
  })
})
