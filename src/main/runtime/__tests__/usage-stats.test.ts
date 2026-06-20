import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const memory: Record<string, any> = {}
const runtimes: Array<{ dispose?: () => void }> = []

vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  }
}))

describe("usageStats", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.doUnmock("../../providers/manager")
    vi.doUnmock("../../providers/client")
    vi.resetModules()
  })

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) runtime.dispose?.()
    vi.useRealTimers()
  })

  it("aggregates actual usage when providers report it", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "hello", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-4o",
      content: "done",
      usage: { input_tokens: 12, output_tokens: 8 }
    })

    const stats = usageStats("all", "models")

    expect(stats.totalTokens).toBe(20)
    expect(stats.actualTokens).toBe(20)
    expect(stats.estimatedTokens).toBe(0)
    expect(stats.hasEstimated).toBe(false)
    expect(stats.inputTokens).toBe(12)
    expect(stats.outputTokens).toBe(8)
    expect(stats.models[0]).toMatchObject({ modelId: "gpt-4o", tokens: 20, actualTokens: 20, estimatedTokens: 0 })
  })

  it("attributes provider direct usage to the selected provider and model", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({
      prompt: "Who are you?",
      mode: "auto",
      workspaceId: null,
      modelSelection: { providerId: "deepseek", modelId: "deepseek-v4-flash", source: "provider" }
    })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "provider:deepseek", {
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      content: "DeepSeek answer",
      usage: { input_tokens: 9, output_tokens: 11 }
    })

    const stats = usageStats("all", "providers")
    const records = usageRecords({ range: "all" }, 1, 10)

    expect(stats.providers[0]).toMatchObject({ providerId: "deepseek", tokens: 20, actualTokens: 20 })
    expect(stats.models[0]).toMatchObject({
      providerId: "deepseek",
      agentId: "provider:deepseek",
      modelId: "deepseek-v4-flash",
      tokens: 20
    })
    expect(records.records[0]).toMatchObject({
      providerId: "deepseek",
      agentId: "provider:deepseek",
      modelId: "deepseek-v4-flash",
      source: "actual"
    })
  })

  it("estimates local CLI and ACP usage when agent done events do not include usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({
      prompt: "Summarize this text",
      mode: "auto",
      workspaceId: null,
      attachments: [{ id: "a1", kind: "text", name: "notes.txt", text: "local attachment text" }]
    })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "claude", {
      providerId: "local-cli",
      modelId: "claude-sonnet-4-5",
      content: "A concise answer with enough characters to estimate."
    })

    const stats = usageStats("all", "models")

    expect(stats.totalTokens).toBeGreaterThan(0)
    expect(stats.actualTokens).toBe(0)
    expect(stats.estimatedTokens).toBe(stats.totalTokens)
    expect(stats.hasEstimated).toBe(true)
    expect(stats.models[0]).toMatchObject({
      agentId: "claude",
      modelId: "claude-sonnet-4-5",
      actualTokens: 0,
      hasEstimated: true
    })
    expect(stats.heatmap.some(day => day.hasEstimated && day.estimatedTokens > 0)).toBe(true)
  })

  it("does not count git or terminal system events as model usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "/git status", mode: "auto", workspaceId: "repo" })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "system", {
      providerId: "local-git",
      modelId: "git",
      content: "M file.ts",
      usage: { total_tokens: 999 }
    })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "system", {
      providerId: "terminal",
      modelId: "terminal",
      content: "ok"
    })

    const stats = usageStats("all", "overview")

    expect(stats.totalTokens).toBe(0)
    expect(stats.actualTokens).toBe(0)
    expect(stats.estimatedTokens).toBe(0)
    expect(stats.messages).toBe(0)
    expect(stats.activeDays).toBe(0)
    expect(stats.models).toEqual([])
  })

  it("does not count gated synthetic release events as a second model request", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "review then answer", mode: "firefly-custom", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "local-cli",
      modelId: "codex",
      content: "candidate answer",
      visibility: "run"
    })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "local-cli",
      modelId: "codex",
      content: "candidate answer",
      visibility: "chat",
      gatedRelease: true,
      synthetic: true,
      usageExcluded: true
    })

    const stats = usageStats("all", "models")

    expect(stats.requests).toBe(1)
    expect(stats.models).toHaveLength(1)
    expect(stats.models[0]).toMatchObject({ agentId: "codex", modelId: "codex", requests: 1 })
  })

  it("normalizes provider cache and Gemini thinking usage", async () => {
    const { normalizeUsage } = await import("../usage-stats")

    expect(normalizeUsage({
      prompt_tokens: 100,
      completion_tokens: 25,
      prompt_tokens_details: { cached_tokens: 40 }
    })).toMatchObject({
      inputTokens: 100,
      outputTokens: 25,
      cacheReadTokens: 40,
      totalTokens: 125
    })

    expect(normalizeUsage({
      input_tokens: 120,
      output_tokens: 30,
      cache_read_input_tokens: 50,
      cache_creation_input_tokens: 15
    })).toMatchObject({
      inputTokens: 120,
      outputTokens: 30,
      cacheReadTokens: 50,
      cacheCreationTokens: 15,
      totalTokens: 215
    })

    expect(normalizeUsage({
      promptTokenCount: 200,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 35,
      totalTokenCount: 260,
      cachedContentTokenCount: 70
    })).toMatchObject({
      inputTokens: 200,
      outputTokens: 60,
      reasoningTokens: 35,
      cacheReadTokens: 70,
      totalTokens: 260
    })
  })

  it("keeps cache-only actual usage and exposes request records", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "cached", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-cache",
      content: "ok",
      usage: { prompt_tokens_details: { cached_tokens: 88 } }
    })

    const stats = usageStats("all", "requests")
    const page = usageRecords({ range: "all" }, 1, 10)

    expect(stats.totalTokens).toBe(88)
    expect(stats.cacheReadTokens).toBe(88)
    expect(stats.actualTokens).toBe(88)
    expect(page.total).toBe(1)
    expect(page.records[0]).toMatchObject({ providerId: "openai", modelId: "gpt-cache", cacheReadTokens: 88, source: "actual" })
  })

  it("calculates cache rate against fresh plus cached input so it never exceeds 100%", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2035-01-15T00:00:00Z"))
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "cache ratio", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "claude", {
      providerId: "anthropic",
      modelId: "claude-sonnet",
      content: "ok",
      usage: { input_tokens: 20, output_tokens: 5, cache_read_input_tokens: 80 }
    })

    const stats = usageStats("7d", "overview")

    expect(stats.cacheReadTokens).toBe(80)
    expect(stats.inputTokens).toBe(20)
    expect(stats.cacheRate).toBeCloseTo(0.8, 5)
  })

  it("calculates cache rate against provider input when cached tokens are already included", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2035-02-15T00:00:00Z"))
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "inclusive cache ratio", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-4o",
      content: "ok",
      usage: { input_tokens: 100, output_tokens: 10, input_tokens_details: { cached_tokens: 40 } }
    })

    const stats = usageStats("7d", "overview")

    expect(stats.inputTokens).toBe(100)
    expect(stats.cacheReadTokens).toBe(40)
    expect(stats.cacheRate).toBeCloseTo(0.4, 5)
  })

  it("records provider direct usage after dispatcher stream events enter the runtime store", async () => {
    vi.doMock("../../providers/manager", () => ({
      getProviderManager: () => ({
        getProvider: (id: string) => id === "deepseek"
          ? {
              id: "deepseek",
              name: "DeepSeek",
              kind: "openai-compatible",
              baseUrl: "https://api.deepseek.example/v1",
              apiKey: "deepseek-key",
              enabled: true,
              builtIn: true,
              models: [{
                id: "deepseek-v4-flash",
                label: "DeepSeek V4 Flash",
                contextWindow: 258000,
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
              defaultThinking: { mode: "off", level: "low" }
            }
          : undefined,
        getBindings: () => [{ agentId: "codex", providerId: "openai", modelId: "gpt-4o" }],
        resolveBinding: () => null
      })
    }))
    vi.doMock("../../providers/client", () => ({
      buildProviderClient: () => ({
        stream: (_opts: any, cb: any) => {
          cb.onContent?.("provider answer")
          cb.onDone?.({
            content: "provider answer",
            usage: { input_tokens: 13, output_tokens: 17 }
          })
        }
      })
    }))

    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const { AgentRegistry } = await import("../../hub/registry")
    const { EventPipeline } = await import("../../hub/pipeline")
    const { Dispatcher } = await import("../../hub/dispatcher")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({
      prompt: "who are you?",
      mode: "auto",
      workspaceId: null,
      modelSelection: { providerId: "deepseek", modelId: "deepseek-v4-flash", source: "provider" }
    })
    const dispatcher = new Dispatcher(new AgentRegistry(), new EventPipeline())
    dispatcher.on("stream", event => runtime.appendStreamEvent(turn.id, event))

    await dispatcher.dispatchProviderDirect(
      "who are you?",
      { providerId: "deepseek", modelId: "deepseek-v4-flash", source: "provider" },
      { turnId: turn.id, messages: [{ role: "user", content: "who are you?" }] }
    )
    const stats = usageStats("all", "providers")
    const page = usageRecords({ range: "all", providerId: "deepseek" }, 1, 10)
    const deepseek = stats.providers.find(row => row.providerId === "deepseek")

    expect(deepseek).toMatchObject({ providerId: "deepseek", actualTokens: 30, tokens: 30 })
    expect(page.total).toBe(1)
    expect(page.records[0]).toMatchObject({
      threadId: thread.id,
      turnId: turn.id,
      providerId: "deepseek",
      agentId: "provider:deepseek",
      modelId: "deepseek-v4-flash",
      source: "actual",
      inputTokens: 13,
      outputTokens: 17
    })
  })

  it("keeps provider-served model IDs separate from requested model IDs", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({
      prompt: "fallback model",
      mode: "auto",
      workspaceId: null,
      modelSelection: { providerId: "openrouter", modelId: "requested-model", source: "provider" }
    })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "provider:openrouter", {
      providerId: "openrouter",
      modelId: "requested-model",
      content: "ok",
      usage: { input_tokens: 6, output_tokens: 4, modelId: "served-model" }
    })

    const stats = usageStats("all", "models")
    const page = usageRecords({ range: "all" }, 1, 10)

    expect(stats.models[0]).toMatchObject({ providerId: "openrouter", modelId: "served-model", tokens: 10 })
    expect(page.records[0]).toMatchObject({
      providerId: "openrouter",
      modelId: "served-model",
      requestModelId: "requested-model"
    })
  })

  it("treats same-agent done events as separate requests when only one has real usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "two requests", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-4o",
      content: "estimated response without usage"
    })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-4o",
      content: "actual response",
      usage: { input_tokens: 4, output_tokens: 6 }
    })

    const stats = usageStats("all", "overview")
    const page = usageRecords({ range: "all" }, 1, 10)

    expect(page.total).toBe(2)
    expect(stats.requests).toBe(2)
    expect(stats.actualTokens).toBe(10)
    expect(stats.estimatedTokens).toBeGreaterThan(0)
  })

  it("rolls up unpriced estimated records into aggregate rows", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "local estimate", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "gemini", {
      providerId: "local-cli",
      modelId: "gemini-cli",
      content: "local answer without usage"
    })

    const stats = usageStats("all", "models")

    expect(stats.hasUnpriced).toBe(true)
    expect(stats.models[0]).toMatchObject({ modelId: "gemini-cli", hasUnpriced: true, hasEstimated: true })
    expect(stats.providers[0]).toMatchObject({ providerId: "local-cli", hasUnpriced: true, hasEstimated: true })
  })

  it("calculates cost with cache-aware billable input and tracks unpriced models", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { upsertUsagePricingRule, usageStats } = await import("../usage-stats")
    upsertUsagePricingRule({
      providerId: "openai",
      modelId: "gpt-priced",
      inputUsdPerMillion: 10,
      outputUsdPerMillion: 20,
      cacheReadUsdPerMillion: 1,
      cacheCreationUsdPerMillion: 5
    })
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const priced = runtime.createTurn({ prompt: "priced", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(priced.thread.id, priced.turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-priced",
      content: "ok",
      usage: { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 40 }, cache_creation_tokens: 10 }
    })
    const unpriced = runtime.createTurn({ prompt: "unpriced", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(unpriced.thread.id, unpriced.turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-unpriced",
      content: "ok",
      usage: { input_tokens: 10, output_tokens: 5 }
    })

    const stats = usageStats("all", "overview")

    expect(stats.costUsd).toBeCloseTo((60 * 10 + 50 * 20 + 40 * 1 + 10 * 5) / 1_000_000, 8)
    expect(stats.hasUnpriced).toBe(true)
    expect(stats.models.find(row => row.modelId === "gpt-priced")?.costUsd).toBeGreaterThan(0)
  })

  it("calculates cost for provider-normalized Anthropic cache usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { upsertUsagePricingRule, usageRecords, usageStats } = await import("../usage-stats")
    upsertUsagePricingRule({
      providerId: "anthropic",
      modelId: "claude-sonnet",
      inputUsdPerMillion: 10,
      outputUsdPerMillion: 20,
      cacheReadUsdPerMillion: 2,
      cacheCreationUsdPerMillion: 6
    })
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "anthropic cache", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "claude", {
      providerId: "anthropic",
      modelId: "claude-sonnet",
      content: "ok",
      usage: {
        input_tokens: 120,
        output_tokens: 30,
        cache_read_tokens: 50,
        cache_creation_tokens: 15,
        total_tokens: 215,
        raw: {
          input_tokens: 120,
          output_tokens: 30,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 15
        }
      }
    })

    const stats = usageStats("all", "overview")
    const page = usageRecords({ range: "all" }, 1, 10)

    expect(page.records[0]).toMatchObject({
      providerId: "anthropic",
      modelId: "claude-sonnet",
      billableInputTokens: 120,
      inputSurfaceTokens: 170,
      cacheReadTokens: 50,
      cacheCreationTokens: 15
    })
    expect(stats.costUsd).toBeCloseTo((120 * 10 + 30 * 20 + 50 * 2 + 15 * 6) / 1_000_000, 8)
    expect(stats.hasUnpriced).toBe(false)
  })

  it("treats zero-priced rules as priced free usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { upsertUsagePricingRule, usageStats } = await import("../usage-stats")
    upsertUsagePricingRule({
      providerId: "free",
      modelId: "free-model",
      inputUsdPerMillion: 0,
      outputUsdPerMillion: 0,
      cacheReadUsdPerMillion: 0,
      cacheCreationUsdPerMillion: 0
    })
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "free", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "provider:free", {
      providerId: "free",
      modelId: "free-model",
      content: "ok",
      usage: { input_tokens: 100, output_tokens: 25, input_tokens_details: { cached_tokens: 10 }, cache_creation_tokens: 5 }
    })

    const stats = usageStats("all", "overview")

    expect(stats.totalTokens).toBe(130)
    expect(stats.costUsd).toBe(0)
    expect(stats.hasUnpriced).toBe(false)
  })

  it("does not add estimated usage for events that already include real usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "hello", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-4o",
      content: "done",
      usage: { input_tokens: 4, output_tokens: 6 }
    })

    const stats = usageStats("all", "overview")
    const page = usageRecords({ range: "all" }, 1, 10)

    expect(page.total).toBe(1)
    expect(stats.totalTokens).toBe(10)
    expect(stats.estimatedTokens).toBe(0)
    expect(stats.actualTokens).toBe(10)
  })

  it("exposes failed and cancelled requests without counting token usage", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const failed = runtime.createTurn({ prompt: "fail this", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(failed.thread.id, failed.turn.id, "agent:error", "provider:deepseek", {
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      error: "quota exceeded"
    })
    const cancelled = runtime.createTurn({ prompt: "cancel this", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(cancelled.thread.id, cancelled.turn.id, "agent:error", "codex", {
      providerId: "local-cli",
      modelId: "codex",
      code: "AGENT_CANCELLED",
      error: "cancelled by user"
    })

    const stats = usageStats("all", "overview")
    const failedPage = usageRecords({ range: "all", status: "failed" }, 1, 10)
    const cancelledPage = usageRecords({ range: "all", status: "cancelled" }, 1, 10)

    expect(stats.totalTokens).toBe(0)
    expect(stats.requests).toBe(2)
    expect(failedPage.records[0]).toMatchObject({
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      source: "none",
      status: "failed",
      totalTokens: 0,
      errorMessage: "quota exceeded"
    })
    expect(cancelledPage.records[0]).toMatchObject({
      agentId: "codex",
      source: "none",
      status: "cancelled",
      totalTokens: 0
    })
  })

  it("records whole-turn cancellations even when no agent error event is emitted", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords, usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { turn } = runtime.createTurn({
      prompt: "cancel provider request",
      mode: "auto",
      workspaceId: null,
      modelSelection: { providerId: "deepseek", modelId: "deepseek-chat", source: "provider" }
    })
    runtime.setTurnStatus(turn.id, "cancelled")

    const stats = usageStats("all", "overview")
    const page = usageRecords({ range: "all", status: "cancelled" }, 1, 10)

    expect(stats.requests).toBe(1)
    expect(stats.totalTokens).toBe(0)
    expect(page.records[0]).toMatchObject({
      providerId: "deepseek",
      agentId: "provider:deepseek",
      modelId: "deepseek-chat",
      source: "none",
      status: "cancelled",
      totalTokens: 0
    })
  })
})

describe("P0-5 usage ledger persistence", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.doUnmock("../../providers/manager")
    vi.doUnmock("../../providers/client")
    vi.resetModules()
  })

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) runtime.dispose?.()
    vi.useRealTimers()
  })

  it("persists usage records to ledger so they survive event trimming", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageStats } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "hello", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "openai",
      modelId: "gpt-4o",
      content: "done",
      usage: { input_tokens: 100, output_tokens: 50 }
    })

    const stats1 = usageStats("all", "overview")
    expect(stats1.totalTokens).toBeGreaterThan(0)

    const ledger = memory["usage.ledger.v1"]
    expect(Array.isArray(ledger)).toBe(true)
    expect(ledger.length).toBe(1)
    expect(ledger[0].providerId).toBe("openai")
    expect(ledger[0].modelId).toBe("gpt-4o")
    expect(ledger[0].source).toBe("actual")

    // Simulate event trimming: new runtime without old events
    for (const r of runtimes.splice(0)) r.dispose?.()
    const newRuntime = new WorkbenchRuntimeStore()
    runtimes.push(newRuntime)

    const stats2 = usageStats("all", "overview")
    expect(stats2.totalTokens).toBeGreaterThan(0)
    expect(stats2.requests).toBe(1)
  })

  it("estimates CJK text tokens higher than naive chars/4", async () => {
    const { WorkbenchRuntimeStore } = await import("../store")
    const { usageRecords } = await import("../usage-stats")
    const runtime = new WorkbenchRuntimeStore()
    runtimes.push(runtime)
    const { thread, turn } = runtime.createTurn({ prompt: "这是一段二十个中文字符的测试文本用于验证", mode: "auto", workspaceId: null })
    runtime.appendSystemEvent(thread.id, turn.id, "agent:done", "codex", {
      providerId: "local-cli",
      modelId: "codex",
      content: "这是一段二十个中文字符的测试文本用于验证"
    })

    const result = usageRecords({}, 1, 50)
    const record = result.records[0]
    if (record && record.source === "estimated") {
      expect(record.inputTokens).toBeGreaterThan(5)
    }
  })
})
