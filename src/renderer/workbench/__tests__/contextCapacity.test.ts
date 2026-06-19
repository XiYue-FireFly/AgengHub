import { describe, expect, it } from "vitest"
import {
  buildContextCapacity,
  estimateContextTokens,
  formatCompactTokens,
  formatContextWindow,
  resolveContextWindow
} from "../contextCapacity"

describe("context capacity estimator", () => {
  it("uses the selected provider model context window and default 258k fallback", () => {
    const providers = [{
      id: "deepseek",
      models: [{ id: "deepseek-v4-flash", contextWindow: 128_000 }]
    }]

    expect(resolveContextWindow({ providerId: "deepseek", modelId: "deepseek-v4-flash", source: "provider" }, providers)).toBe(128_000)
    expect(resolveContextWindow({ providerId: "deepseek", modelId: "missing", source: "provider" }, providers)).toBe(258_000)
    expect(resolveContextWindow(null, providers)).toBe(258_000)
  })

  it("estimates mixed CJK and ASCII text deterministically", () => {
    expect(estimateContextTokens("abcd")).toBe(1)
    expect(estimateContextTokens("你好世界")).toBe(4)
    expect(estimateContextTokens("hello 世界")).toBe(4)
  })

  it("builds category totals, free tokens, and threshold tones", () => {
    const providers = [{ id: "tiny", models: [{ id: "tiny-model", contextWindow: 4_000 }] }]
    const result = buildContextCapacity({
      turns: [{ prompt: "x".repeat(1600) }],
      events: [{ kind: "agent:done", payload: { content: "y".repeat(1600) } }],
      attachments: [{ text: "z".repeat(800), name: "note.txt" }],
      workspaceBound: true,
      modelSelection: { providerId: "tiny", modelId: "tiny-model", source: "provider" },
      providers
    })

    expect(result.windowTokens).toBe(4_000)
    expect(result.usedTokens).toBe(4_000)
    expect(result.freeTokens).toBe(0)
    expect(result.tone).toBe("danger")
    expect(result.categories.map(item => item.key)).toEqual(["system", "messages", "attachments", "skills", "workspace"])
    expect(result.categories.reduce((sum, item) => sum + item.tokens, 0)).toBeLessThanOrEqual(result.usedTokens + result.categories.length)
  })

  it("counts the current composer draft in message usage", () => {
    const base = buildContextCapacity({
      turns: [],
      events: [],
      attachments: [],
      workspaceBound: false,
      modelSelection: null,
      providers: []
    })
    const withDraft = buildContextCapacity({
      turns: [],
      events: [],
      attachments: [],
      draftText: "draft ".repeat(400),
      workspaceBound: false,
      modelSelection: null,
      providers: []
    })

    expect(withDraft.usedTokens).toBeGreaterThan(base.usedTokens)
    expect(withDraft.categories.find(item => item.key === "messages")?.tokens).toBeGreaterThan(0)
  })

  it("excludes run-only reviewer and gatekeeper outputs from message usage", () => {
    const visible = buildContextCapacity({
      turns: [],
      events: [{ kind: "agent:done", payload: { content: "main answer ".repeat(80), visibility: "chat" } }],
      attachments: [],
      workspaceBound: false,
      modelSelection: null,
      providers: []
    })
    const withRunOnly = buildContextCapacity({
      turns: [],
      events: [
        { kind: "agent:done", payload: { content: "main answer ".repeat(80), visibility: "chat" } },
        { kind: "agent:done", payload: { content: "reviewer notes ".repeat(800), visibility: "run" } }
      ],
      attachments: [],
      workspaceBound: false,
      modelSelection: null,
      providers: []
    })

    expect(withRunOnly.categories.find(item => item.key === "messages")?.tokens).toBe(
      visible.categories.find(item => item.key === "messages")?.tokens
    )
  })

  it("formats model windows and compact token counts", () => {
    expect(formatContextWindow(258_000)).toBe("258k")
    expect(formatContextWindow(1_200_000)).toBe("1M")
    expect(formatCompactTokens(950)).toBe("950")
    expect(formatCompactTokens(12_300)).toBe("12k")
    expect(formatCompactTokens(1_250_000)).toBe("1.3M")
  })
})
