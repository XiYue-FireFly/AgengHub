import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { readCodexConfig, readGeminiConfig, readClaudeConfig, scanLocalModels } from "../local-models"

describe("local model config readers", () => {
  it("reads Codex model, auth and cached model catalog from local config files", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-codex-"))
    writeFileSync(join(root, "config.toml"), 'model = "gpt-4.1"\nbase_url = "https://api.example.test/v1"\n')
    writeFileSync(join(root, "auth.json"), JSON.stringify({ openai_api_key: "redacted" }))
    writeFileSync(join(root, "models_cache.json"), JSON.stringify({ models: [{ id: "gpt-4.1", label: "GPT 4.1" }] }))

    const config = readCodexConfig(root)

    expect(config.status).toBe("ok")
    expect(config.modelId).toBe("gpt-4.1")
    expect(config.authMode).toBe("api-key")
    expect(config.baseUrl).toBe("https://api.example.test/v1")
    expect(config.models?.map(model => model.id)).toContain("gpt-4.1")
  })

  it("keeps the configured Codex model visible even when cache files are empty", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-codex-config-only-"))
    writeFileSync(join(root, "config.toml"), 'model = "gpt-5.5"\nmodel_context_window = 258000\n')

    const config = readCodexConfig(root)

    expect(config.status).toBe("ok")
    expect(config.modelId).toBe("gpt-5.5")
    expect(config.models?.[0]).toMatchObject({ id: "gpt-5.5", contextWindow: 258000 })
  })

  it("reads real Codex cache field names from cc-switch style model files", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-codex-cache-shape-"))
    writeFileSync(join(root, "config.toml"), 'model = "gpt-5.5"\n')
    writeFileSync(join(root, "models_cache.json"), JSON.stringify({
      fetched_at: "2026-06-22T00:00:00Z",
      models: [
        { slug: "gpt-5.5", display_name: "GPT 5.5", context_window: 272000, max_context_window: 400000 },
        { slug: "gpt-5-mini", display_name: "GPT 5 Mini", model_context_window: 128000 }
      ]
    }))

    const config = readCodexConfig(root)

    expect(config.models?.[0]).toMatchObject({ id: "gpt-5.5", label: "GPT 5.5", contextWindow: 272000 })
    expect(config.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "gpt-5-mini", label: "GPT 5 Mini", contextWindow: 128000 })
    ]))
  })

  it("reads Codex cc-switch model catalog path and context fields", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-codex-catalog-"))
    writeFileSync(join(root, "config.toml"), [
      'model = "gpt-5.1-codex"',
      'model_catalog_json = "cc-switch-model-catalog.json"',
      'model_context_window = 258000'
    ].join("\n"))
    writeFileSync(join(root, "auth.json"), JSON.stringify({ OPENAI_API_KEY: "redacted" }))
    writeFileSync(join(root, "cc-switch-model-catalog.json"), JSON.stringify({
      models: [
        { slug: "gpt-5.1-codex", display_name: "GPT 5.1 Codex", max_context_window: 512000 },
        { slug: "codex-mini", display_name: "Codex Mini" }
      ]
    }))

    const config = readCodexConfig(root)

    expect(config.status).toBe("ok")
    expect(config.modelId).toBe("gpt-5.1-codex")
    expect(config.authMode).toBe("api-key")
    expect(config.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "gpt-5.1-codex", label: "GPT 5.1 Codex", contextWindow: 512000 }),
      expect.objectContaining({ id: "codex-mini", label: "Codex Mini", contextWindow: 258000 })
    ]))
  })

  it("reads Gemini model and API key mode from local env/settings files", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-gemini-"))
    writeFileSync(join(root, ".env"), 'export GEMINI_MODEL="gemini-2.5-pro" # current model\nGEMINI_API_KEY=redacted\n')
    writeFileSync(join(root, "settings.json"), JSON.stringify({ baseUrl: "https://generativelanguage.googleapis.com" }))

    const config = readGeminiConfig(root)

    expect(config.status).toBe("ok")
    expect(config.modelId).toBe("gemini-2.5-pro")
    expect(config.authMode).toBe("api-key")
    expect(config.baseUrl).toBe("https://generativelanguage.googleapis.com")
  })

  it("ignores non-model Codex JSON objects instead of inventing model ids", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-codex-noise-"))
    writeFileSync(join(root, "config.toml"), "")
    writeFileSync(join(root, "models_cache.json"), JSON.stringify({ token: "not-a-model", metadata: { version: "1" } }))

    const config = readCodexConfig(root)

    expect(config.models).toEqual([])
  })

  it("returns stable Gemini defaults when only auth is present", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-gemini-auth-only-"))
    writeFileSync(join(root, ".env"), "GEMINI_API_KEY=redacted\n")

    const config = readGeminiConfig(root)

    expect(config.status).toBe("ok")
    expect(config.authMode).toBe("api-key")
    expect(config.modelId).toBe("gemini-2.5-pro")
    expect(config.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 258000 }),
      expect.objectContaining({ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 258000 })
    ]))
  })

  it("moves the configured Gemini model to the front of the model list", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-gemini-selected-"))
    writeFileSync(join(root, ".env"), "GEMINI_MODEL=gemini-custom\nGEMINI_API_KEY=redacted\n")

    const config = readGeminiConfig(root)

    expect(config.status).toBe("ok")
    expect(config.modelId).toBe("gemini-custom")
    expect(config.models?.[0]).toMatchObject({ id: "gemini-custom", contextWindow: 258000 })
  })

  it("uses GEMINI_CLI_HOME when no explicit Gemini root is passed", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-gemini-home-"))
    const previous = process.env.GEMINI_CLI_HOME
    writeFileSync(join(root, ".env"), "GEMINI_API_KEY=redacted\n")
    process.env.GEMINI_CLI_HOME = root
    try {
      const config = readGeminiConfig()
      expect(config.configPath).toBe(join(root, ".env"))
      expect(config.models?.map(model => model.id)).toContain("gemini-2.5-pro")
    } finally {
      if (previous === undefined) delete process.env.GEMINI_CLI_HOME
      else process.env.GEMINI_CLI_HOME = previous
    }
  })

  it("reads Claude model overrides from settings.json env", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-claude-"))
    writeFileSync(join(root, "settings.json"), JSON.stringify({
      env: {
        ANTHROPIC_MODEL: "claude-opus-4-8",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5-20251001"
      }
    }))

    const config = readClaudeConfig(root)

    expect(config.status).toBe("ok")
    expect(config.source).toBe("claude")
    expect(config.agentId).toBe("claude")
    expect(config.modelId).toBe("claude-opus-4-8")
    expect(config.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "settings-main", label: "claude-opus-4-8" }),
      expect.objectContaining({ id: "settings-sonnet", label: "claude-sonnet-4-6" }),
      expect.objectContaining({ id: "settings-haiku", label: "claude-haiku-4-5-20251001" })
    ]))
  })

  it("returns partial status when settings.json exists but has no model overrides", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-claude-no-models-"))
    writeFileSync(join(root, "settings.json"), JSON.stringify({ includeCoAuthoredBy: false }))

    const prevModel = process.env.ANTHROPIC_MODEL
    const prevSonnet = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    const prevOpus = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    const prevHaiku = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
    const prevReasoning = process.env.ANTHROPIC_REASONING_MODEL
    delete process.env.ANTHROPIC_MODEL
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
    delete process.env.ANTHROPIC_REASONING_MODEL
    try {
      const config = readClaudeConfig(root)
      expect(config.status).toBe("partial")
      expect(config.models).toEqual([])
      expect(config.authMode).toBe("unknown")
    } finally {
      if (prevModel !== undefined) process.env.ANTHROPIC_MODEL = prevModel
      if (prevSonnet !== undefined) process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = prevSonnet
      if (prevOpus !== undefined) process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = prevOpus
      if (prevHaiku !== undefined) process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = prevHaiku
      if (prevReasoning !== undefined) process.env.ANTHROPIC_REASONING_MODEL = prevReasoning
    }
  })

  it("returns missing status when no settings.json exists and no env vars set", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-claude-empty-noreal-"))
    // Temporarily clear env vars that readClaudeConfig falls back to
    const prevModel = process.env.ANTHROPIC_MODEL
    const prevSonnet = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    const prevOpus = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    const prevHaiku = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
    const prevReasoning = process.env.ANTHROPIC_REASONING_MODEL
    const prevBaseUrl = process.env.ANTHROPIC_BASE_URL
    delete process.env.ANTHROPIC_MODEL
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
    delete process.env.ANTHROPIC_REASONING_MODEL
    delete process.env.ANTHROPIC_BASE_URL
    try {
      const config = readClaudeConfig(root)
      expect(config.status).toBe("missing")
      expect(config.models).toEqual([])
      expect(config.source).toBe("claude")
      expect(config.agentId).toBe("claude")
    } finally {
      if (prevModel !== undefined) process.env.ANTHROPIC_MODEL = prevModel
      if (prevSonnet !== undefined) process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = prevSonnet
      if (prevOpus !== undefined) process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = prevOpus
      if (prevHaiku !== undefined) process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = prevHaiku
      if (prevReasoning !== undefined) process.env.ANTHROPIC_REASONING_MODEL = prevReasoning
      if (prevBaseUrl !== undefined) process.env.ANTHROPIC_BASE_URL = prevBaseUrl
    }
  })

  it("reads ANTHROPIC_BASE_URL from settings.json env", () => {
    const root = mkdtempSync(join(tmpdir(), "agenthub-claude-baseurl-"))
    writeFileSync(join(root, "settings.json"), JSON.stringify({
      env: {
        ANTHROPIC_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_BASE_URL: "https://token-plan-sgp.xiaomimimo.com/anthropic"
      }
    }))

    const config = readClaudeConfig(root)

    expect(config.status).toBe("ok")
    expect(config.modelId).toBe("mimo-v2.5-pro")
    expect(config.baseUrl).toBe("https://token-plan-sgp.xiaomimimo.com/anthropic")
  })

  it("scanLocalModels returns codex, gemini, and claude results", () => {
    const results = scanLocalModels()
    const sources = results.map(r => r.source)
    expect(sources).toContain("codex")
    expect(sources).toContain("gemini")
    expect(sources).toContain("claude")
  })
})
