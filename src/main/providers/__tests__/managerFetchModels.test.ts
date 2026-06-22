import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildClaudeProviderReorderIds, deriveModelListCandidates, parseFetchedModels } from "../manager"

const memory: Record<string, any> = {}

vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  },
  encryptSecret: (value: string) => value,
  decryptSecret: (value: string) => value
}))

describe("ProviderManager.fetchModels", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it("keeps existing models and records the error when a refresh fails", async () => {
    const { ProviderManager } = await import("../manager")
    const manager = new ProviderManager()
    manager.upsertProvider({
      id: "custom-test",
      name: "Custom Test",
      kind: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKey: "key",
      enabled: true,
      builtIn: false,
      models: [{
        id: "kept-model",
        label: "Kept Model",
        contextWindow: 128000,
        supportsTools: true,
        supportsVision: false,
        supportsThinking: false
      }],
      capabilities: {
        protocol: "chat_completions",
        stream: true,
        nativeThinking: false,
        budgetTokens: false,
        toolCalls: true,
        systemPrompt: true
      },
      defaultThinking: { mode: "auto", level: "medium", collapseInUI: true }
    })
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 500 })))

    const result = await manager.fetchModels("custom-test")
    const provider = manager.getProvider("custom-test")!

    expect(result).toMatchObject({ ok: false, error: "HTTP 500", count: 1 })
    expect(provider.models.map(model => model.id)).toEqual(["kept-model"])
    expect(provider.modelFetch).toMatchObject({ status: "error", error: "HTTP 500", lastSuccessCount: 1 })
  })

  it("merges successful model refreshes with route-bound models", async () => {
    const { ProviderManager } = await import("../manager")
    const manager = new ProviderManager()
    manager.setProviderApiKey("openai", "key")
    vi.stubGlobal("fetch", vi.fn(async () => ({
      status: 200,
      json: async () => ({ data: [{ id: "fresh-model" }] })
    })))

    const result = await manager.fetchModels("openai")
    const provider = manager.getProvider("openai")!

    expect(result.ok).toBe(true)
    expect(provider.models.some(model => model.id === "fresh-model")).toBe(true)
    expect(provider.models.some(model => model.id === "gpt-4o")).toBe(true)
    expect(provider.modelFetch).toMatchObject({ status: "ok", lastSuccessCount: provider.models.length })
  })

  it("fetches models with current form overrides before saved API key is present", async () => {
    const { ProviderManager } = await import("../manager")
    const manager = new ProviderManager()
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push({ url, headers: init.headers })
      return {
        status: 200,
        json: async () => ({ data: [{ id: "claude-live", display_name: "Claude Live" }] })
      }
    }))

    const result = await manager.fetchModels("anthropic", {
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "live-key",
      kind: "anthropic"
    })
    const provider = manager.getProvider("anthropic")!

    expect(result.ok).toBe(true)
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/models")
    expect(calls[0].headers.authorization).toBe("Bearer live-key")
    expect(calls[0].headers["x-api-key"]).toBe("live-key")
    expect(provider.apiKey).toBe("live-key")
    expect(provider.models.some(model => model.id === "claude-live")).toBe(true)
  })

  it("derives Claude-compatible model endpoints from base URLs", () => {
    expect(deriveModelListCandidates("https://api.example.com", "anthropic")).toEqual([
      "https://api.example.com/v1/models",
      "https://api.example.com/models?limit=200"
    ])
    expect(deriveModelListCandidates("https://api.example.com/v1", "anthropic")).toEqual([
      "https://api.example.com/v1/models",
      "https://api.example.com/v1/v1/models",
      "https://api.example.com/v1/models?limit=200"
    ])
    expect(deriveModelListCandidates(" https://localhost:8787/api/anthropic/// ", "anthropic")).toEqual([
      "https://localhost:8787/api/anthropic/v1/models",
      "https://localhost:8787/api/anthropic/models?limit=200",
      "https://localhost:8787/api/v1/models",
      "https://localhost:8787/v1/models",
    ])
  })

  it("parses model list response shapes", () => {
    expect(parseFetchedModels({ data: [{ id: "claude-sonnet", display_name: "Claude Sonnet" }] }, "anthropic")).toEqual([
      { id: "claude-sonnet", label: "Claude Sonnet", contextWindow: undefined }
    ])
    expect(parseFetchedModels(["model-a", { id: "model-b", context_window: 1000 }], "openai-compatible")).toEqual([
      { id: "model-a", label: "model-a", contextWindow: undefined },
      { id: "model-b", label: "model-b", contextWindow: 1000 }
    ])
    expect(parseFetchedModels({ models: [{ name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", inputTokenLimit: 1048576 }] }, "gemini")).toEqual([
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 1048576 }
    ])
  })

  it("continues to next candidate when first returns 200 with empty model list", async () => {
    const { ProviderManager } = await import("../manager")
    const manager = new ProviderManager()
    manager.setProviderApiKey("openai", "key")
    let callCount = 0
    vi.stubGlobal("fetch", vi.fn(async () => {
      callCount++
      if (callCount === 1) {
        return { status: 200, json: async () => ({ data: [] }) }
      }
      return { status: 200, json: async () => ({ data: [{ id: "fallback-model" }] }) }
    }))

    const result = await manager.fetchModels("openai")

    expect(result.ok).toBe(true)
    expect(callCount).toBeGreaterThan(1)
    expect(manager.getProvider("openai")!.models.some(m => m.id === "fallback-model")).toBe(true)
  })

  it("keeps current Claude provider in its home index when reordering other providers", () => {
    expect(buildClaudeProviderReorderIds([
      { id: "a" },
      { id: "b", isActive: true },
      { id: "c" }
    ], 1, 0)).toEqual(["c", "b", "a"])
  })

  it("persists Claude provider order without changing binding, enabled state, or api key", async () => {
    const { ProviderManager } = await import("../manager")
    const manager = new ProviderManager()
    manager.setProviderApiKey("openai", "openai-key")
    manager.setProviderApiKey("anthropic", "anthropic-key")
    manager.upsertBinding({
      ...manager.getBinding("claude")!,
      providerId: "anthropic"
    })

    manager.reorderProvidersForClaude(["openai", "anthropic", "deepseek"])

    expect(manager.getBinding("claude")?.providerId).toBe("anthropic")
    expect(manager.getProvider("anthropic")).toMatchObject({ apiKey: "anthropic-key", enabled: true })
    expect(manager.getProvider("openai")?.sortOrder).toBe(0)
    expect(manager.getProvider("deepseek")?.sortOrder).toBe(2)
  })
})
