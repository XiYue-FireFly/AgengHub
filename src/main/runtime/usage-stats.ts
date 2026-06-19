import { store } from "../store"
import { getWorkbenchRuntimeStore } from "./store"
import type {
  PaginatedUsageRecords,
  RuntimeEvent,
  UsageHeatmapDay,
  UsageModelRow,
  UsagePricingRule,
  UsageProviderRow,
  UsageRange,
  UsageRecordFilter,
  UsageRequestRecord,
  UsageSource,
  UsageStats,
  UsageTokenBreakdown,
  UsageView,
  WorkbenchTurn
} from "./types"

const DAY_MS = 86_400_000
const CHARS_PER_TOKEN = 4
const PRICING_KEY = "usage.pricing.v1"

interface UsageBucket {
  tokens: number
  actualTokens: number
  estimatedTokens: number
  hasEstimated: boolean
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  cacheSavingsTokens: number
  billableInputTokens: number
  inputSurfaceTokens: number
  costUsd: number | null
  hasUnpriced: boolean
  requests: number
  turnIds: Set<string>
}

interface PricingState {
  version: 1
  rules: UsagePricingRule[]
}

export function usageStats(range: UsageRange = "all", view: UsageView = "overview"): UsageStats {
  const records = filterUsageRecords(buildUsageRecords(), { range })
  const turns = turnsForUsageRecords(records)
  const usageByTurn = usageTokensByTurn(records)
  const totals = records.reduce((bucket, record) => addRecordToBucket(bucket, record), emptyUsageBucket())
  const heatmap = buildHeatmap(turns, usageByTurn, range)
  const activeDaysSet = new Set(heatmap.filter(day => day.turns > 0 || day.tokens > 0).map(day => day.date))

  return {
    range,
    view,
    sessions: new Set(turns.map(turn => turn.threadId)).size,
    messages: turns.length,
    totalTokens: totals.tokens,
    actualTokens: totals.actualTokens,
    estimatedTokens: totals.estimatedTokens,
    hasEstimated: totals.hasEstimated,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheReadTokens: totals.cacheReadTokens,
    cacheCreationTokens: totals.cacheCreationTokens,
    cacheSavingsTokens: totals.cacheSavingsTokens,
    billableInputTokens: totals.billableInputTokens,
    activeDays: activeDaysSet.size,
    currentStreak: currentStreak(activeDaysSet),
    longestStreak: longestStreak(activeDaysSet),
    cost: totals.costUsd,
    costUsd: totals.costUsd,
    hasUnpriced: totals.hasUnpriced,
    cacheSavings: totals.cacheSavingsTokens,
    contextSavings: null,
    cacheRate: cacheRate(totals),
    requests: totals.requests,
    heatmap,
    models: modelRows(records),
    providers: providerRows(records)
  }
}

export function usageRecords(filter: UsageRecordFilter = {}, page = 1, pageSize = 50): PaginatedUsageRecords {
  const safePage = Math.max(1, Math.floor(Number(page) || 1))
  const safePageSize = Math.max(1, Math.min(200, Math.floor(Number(pageSize) || 50)))
  const records = filterUsageRecords(buildUsageRecords(), filter)
  const start = (safePage - 1) * safePageSize
  return {
    records: records.slice(start, start + safePageSize),
    total: records.length,
    page: safePage,
    pageSize: safePageSize
  }
}

export function usageRecordDetail(id: string): UsageRequestRecord | null {
  return buildUsageRecords().find(record => record.id === id) ?? null
}

export function listUsagePricingRules(): UsagePricingRule[] {
  return pricingState().rules
}

export function upsertUsagePricingRule(input: Partial<UsagePricingRule> & { modelId: string }): UsagePricingRule {
  const modelId = String(input.modelId || "").trim()
  if (!modelId) throw new Error("modelId is required")
  const now = Date.now()
  const state = pricingState()
  const providerId = normalizeOptionalString(input.providerId)
  const id = pricingRuleId(providerId, modelId)
  const existing = state.rules.find(rule => rule.id === id)
  const next: UsagePricingRule = {
    id,
    providerId,
    modelId,
    displayName: normalizeOptionalString(input.displayName),
    inputUsdPerMillion: nonNegativeNumber(input.inputUsdPerMillion),
    outputUsdPerMillion: nonNegativeNumber(input.outputUsdPerMillion),
    cacheReadUsdPerMillion: optionalNonNegativeNumber(input.cacheReadUsdPerMillion),
    cacheCreationUsdPerMillion: optionalNonNegativeNumber(input.cacheCreationUsdPerMillion),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  state.rules = existing ? state.rules.map(rule => rule.id === id ? next : rule) : [...state.rules, next]
  savePricingState(state)
  return next
}

export function deleteUsagePricingRule(idOrModelId: string, providerId?: string): boolean {
  const state = pricingState()
  const id = providerId ? pricingRuleId(providerId, idOrModelId) : String(idOrModelId || "")
  const before = state.rules.length
  state.rules = state.rules.filter(rule => rule.id !== id && rule.modelId !== id)
  if (state.rules.length !== before) savePricingState(state)
  return state.rules.length !== before
}

export function normalizeUsage(usage: any): UsageTokenBreakdown | null {
  if (!usage || typeof usage !== "object") return null
  const raw = usage.usageMetadata && typeof usage.usageMetadata === "object" ? usage.usageMetadata : usage
  const inputTokens = firstNumber(
    raw.inputTokens,
    raw.input_tokens,
    raw.promptTokens,
    raw.prompt_tokens,
    raw.promptTokenCount,
    raw.prompt_token_count
  ) ?? 0
  const cacheReadTokens = firstNumber(
    raw.cacheReadTokens,
    raw.cache_read_tokens,
    raw.cache_read_input_tokens,
    raw.cacheReadInputTokens,
    raw.cachedContentTokenCount,
    raw.cached_content_token_count,
    raw.prompt_tokens_details?.cached_tokens,
    raw.input_tokens_details?.cached_tokens,
    raw.inputTokensDetails?.cachedTokens
  ) ?? 0
  const cacheCreationTokens = firstNumber(
    raw.cacheCreationTokens,
    raw.cache_creation_tokens,
    raw.cache_creation_input_tokens,
    raw.cacheCreationInputTokens
  ) ?? 0
  const reasoningTokens = firstNumber(
    raw.reasoningTokens,
    raw.reasoning_tokens,
    raw.thoughtsTokenCount,
    raw.thoughts_token_count,
    raw.output_tokens_details?.reasoning_tokens,
    raw.completion_tokens_details?.reasoning_tokens
  ) ?? 0
  const reportedTotal = firstNumber(raw.totalTokens, raw.total_tokens, raw.totalTokenCount, raw.total_token_count)
  const explicitOutput = firstNumber(
    raw.outputTokens,
    raw.output_tokens,
    raw.completionTokens,
    raw.completion_tokens,
    raw.candidatesTokenCount,
    raw.candidates_token_count
  )
  const outputTokens = geminiOutputFromTotal(raw, inputTokens, reportedTotal ?? undefined) ?? explicitOutput ?? 0
  const cacheReadInputIncluded = cacheReadAlreadyInInput(raw)
  const fallbackTotal =
    inputTokens +
    outputTokens +
    cacheCreationTokens +
    (cacheReadInputIncluded ? 0 : cacheReadTokens)
  const totalTokens = Math.max(
    reportedTotal ?? 0,
    fallbackTotal,
    cacheReadTokens,
    cacheCreationTokens
  )
  if (totalTokens <= 0 && inputTokens <= 0 && outputTokens <= 0 && cacheReadTokens <= 0 && cacheCreationTokens <= 0) return null
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    billableInputTokens: cacheReadInputIncluded ? Math.max(inputTokens - cacheReadTokens, 0) : inputTokens,
    inputSurfaceTokens: inputSurfaceTokens(inputTokens, cacheReadTokens, cacheReadInputIncluded),
    cacheReadInputIncluded,
    totalTokens: totalTokens || inputTokens + outputTokens + cacheCreationTokens,
    reasoningTokens,
    modelId: normalizeOptionalString(raw.modelId) || normalizeOptionalString(raw.model) || normalizeOptionalString(raw.modelVersion)
  }
}

export function estimateUsageForDoneEvent(turn: WorkbenchTurn, event: RuntimeEvent): UsageTokenBreakdown {
  const promptText = turn.prompt || ""
  const attachmentText = (turn.attachments || [])
    .filter(attachment => attachment.kind !== "image")
    .map(attachment => [attachment.name, attachment.text].filter(Boolean).join("\n"))
    .join("\n")
  const outputText = [
    event.payload?.content,
    event.payload?.thinking,
    event.payload?.summary?.preview
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join("\n")
  const inputTokens = estimateTokens([promptText, attachmentText].join("\n"))
  const outputTokens = estimateTokens(outputText)
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    billableInputTokens: inputTokens,
    inputSurfaceTokens: inputTokens,
    totalTokens: inputTokens + outputTokens
  }
}

export function isModelUsageEvent(event: RuntimeEvent): boolean {
  if (event.kind !== "agent:done" && event.kind !== "agent:error") return false
  if (event.payload?.usageExcluded || event.payload?.synthetic) return false
  const providerId = providerIdForEvent(event).toLowerCase()
  const agentId = String(event.agentId || event.payload?.agentId || "").toLowerCase()
  if (!providerId || providerId === "system" || providerId === "terminal" || providerId === "git") return false
  if (providerId.includes("terminal") || providerId.includes("git")) return false
  if (agentId === "system" || agentId.includes("terminal") || agentId.includes("git")) return false
  return Boolean(event.agentId || event.payload?.agentId)
}

function buildUsageRecords(): UsageRequestRecord[] {
  const runtime = getWorkbenchRuntimeStore()
  const snapshot = runtime.snapshot(undefined)
  const turnById = new Map(snapshot.turns.map(turn => [turn.id, turn]))
  const turnIds = new Set(snapshot.turns.map(turn => turn.id))
  const events = snapshot.threads
    .flatMap(thread => runtime.eventsSince(thread.id, 0))
    .filter(event => turnIds.has(event.turnId) && isModelUsageEvent(event))
  const doneEvents = events.filter(event => event.kind === "agent:done")
  const errorEvents = events.filter(event => event.kind === "agent:error")
  const errorTurnIds = new Set(errorEvents.map(event => event.turnId))
  const actualEventIds = new Set<string>()
  const records: UsageRequestRecord[] = []

  for (const event of doneEvents) {
    const usage = normalizeUsage(event.payload?.usage)
    if (!usage || usage.totalTokens <= 0) continue
    const record = recordFromEvent(event, usage, "actual", turnById.get(event.turnId))
    actualEventIds.add(event.id)
    records.push(record)
  }

  for (const event of doneEvents) {
    if (actualEventIds.has(event.id)) continue
    const turn = turnById.get(event.turnId)
    if (!turn) continue
    const modelId = modelIdForEvent(event)
    const providerId = providerIdForEvent(event)
    const estimated = estimateUsageForDoneEvent(turn, event)
    if (estimated.totalTokens <= 0) continue
    records.push(recordFromEvent(event, estimated, "estimated", turn))
  }

  for (const event of errorEvents) {
    records.push(emptyRecordFromEvent(event, turnById.get(event.turnId)))
  }

  for (const turn of snapshot.turns) {
    if (turn.status !== "cancelled" || errorTurnIds.has(turn.id)) continue
    const threadEvents = runtime.eventsSince(turn.threadId, 0)
    const event = [...threadEvents].reverse().find(item => item.turnId === turn.id && item.kind === "turn:status" && item.payload?.status === "cancelled")
    if (event) records.push(emptyRecordFromTurnStatus(event, turn))
  }

  return records.sort((a, b) => b.createdAt - a.createdAt)
}

function recordFromEvent(event: RuntimeEvent, usage: UsageTokenBreakdown, source: UsageSource, turn?: WorkbenchTurn): UsageRequestRecord {
  const providerId = providerIdForEvent(event)
  const modelId = modelIdForEvent(event, usage.modelId)
  const agentId = event.agentId || normalizeOptionalString(event.payload?.agentId)
  const priced = priceUsage(providerId, modelId, usage)
  const responsePreview = previewText(event.payload?.content || event.payload?.summary?.preview || "")
  const promptPreview = previewText(turn?.prompt || "")
  const totalTokens = usage.totalTokens || usage.inputTokens + usage.outputTokens
  const cacheReadInputIncluded = usage.cacheReadInputIncluded ?? inputIncludesCacheRead(providerId, modelId)
  return {
    id: `${event.id}:${source}`,
    eventId: event.id,
    threadId: event.threadId,
    turnId: event.turnId,
    agentId,
    providerId,
    modelId,
    requestModelId: normalizeOptionalString(event.payload?.requestModelId) || normalizeOptionalString(event.payload?.modelId) || normalizeOptionalString(turn?.modelSelection?.modelId) || modelId,
    source,
    status: "completed",
    createdAt: event.createdAt,
    latencyMs: optionalPositiveNumber(event.payload?.durationMs ?? event.payload?.latencyMs),
    firstTokenMs: optionalPositiveNumber(event.payload?.firstTokenMs),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    billableInputTokens: billableInputTokens(providerId, modelId, usage),
    inputSurfaceTokens: usage.inputSurfaceTokens ?? inputSurfaceTokens(usage.inputTokens, usage.cacheReadTokens, cacheReadInputIncluded),
    totalTokens,
    actualTokens: source === "actual" ? totalTokens : 0,
    estimatedTokens: source === "estimated" ? totalTokens : 0,
    hasEstimated: source === "estimated",
    reasoningTokens: usage.reasoningTokens,
    costUsd: priced.costUsd,
    hasUnpriced: priced.hasUnpriced,
    promptPreview,
    responsePreview,
    rawUsage: source === "actual" ? event.payload?.usage : undefined
  }
}

function emptyRecordFromEvent(event: RuntimeEvent, turn?: WorkbenchTurn): UsageRequestRecord {
  const providerId = providerIdForEvent(event)
  const modelId = modelIdForEvent(event)
  const agentId = event.agentId || normalizeOptionalString(event.payload?.agentId)
  const status = event.payload?.code === "AGENT_CANCELLED" || event.payload?.status === "cancelled" ? "cancelled" : "failed"
  return {
    id: `${event.id}:none`,
    eventId: event.id,
    threadId: event.threadId,
    turnId: event.turnId,
    agentId,
    providerId,
    modelId,
    requestModelId: normalizeOptionalString(event.payload?.requestModelId) || normalizeOptionalString(event.payload?.modelId) || normalizeOptionalString(turn?.modelSelection?.modelId) || modelId,
    source: "none",
    status,
    createdAt: event.createdAt,
    latencyMs: optionalPositiveNumber(event.payload?.durationMs ?? event.payload?.latencyMs),
    firstTokenMs: optionalPositiveNumber(event.payload?.firstTokenMs),
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    billableInputTokens: 0,
    inputSurfaceTokens: 0,
    totalTokens: 0,
    actualTokens: 0,
    estimatedTokens: 0,
    hasEstimated: false,
    costUsd: null,
    hasUnpriced: false,
    promptPreview: previewText(turn?.prompt || ""),
    responsePreview: previewText(event.payload?.content || ""),
    errorMessage: normalizeOptionalString(event.payload?.error) || normalizeOptionalString(event.payload?.message) || normalizeOptionalString(event.payload?.code)
  }
}

function emptyRecordFromTurnStatus(event: RuntimeEvent, turn: WorkbenchTurn): UsageRequestRecord {
  const providerId = turn.modelSelection?.source === "provider" && turn.modelSelection.providerId
    ? turn.modelSelection.providerId
    : "local-cli"
  const modelId = turn.modelSelection?.modelId || turn.targetAgent || "unknown"
  return {
    id: `${event.id}:none`,
    eventId: event.id,
    threadId: event.threadId,
    turnId: event.turnId,
    agentId: turn.targetAgent || (turn.modelSelection?.source === "provider" ? `provider:${turn.modelSelection.providerId}` : undefined),
    providerId,
    modelId,
    requestModelId: turn.modelSelection?.modelId || modelId,
    source: "none",
    status: "cancelled",
    createdAt: event.createdAt,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    billableInputTokens: 0,
    inputSurfaceTokens: 0,
    totalTokens: 0,
    actualTokens: 0,
    estimatedTokens: 0,
    hasEstimated: false,
    costUsd: null,
    hasUnpriced: false,
    promptPreview: previewText(turn.prompt || ""),
    errorMessage: normalizeOptionalString(event.payload?.error) || "cancelled"
  }
}

function filterUsageRecords(records: UsageRequestRecord[], filter: UsageRecordFilter): UsageRequestRecord[] {
  const fromRange = rangeStart(filter.range || "all")
  const from = filter.from ?? fromRange ?? null
  const to = filter.to ?? null
  const query = String(filter.query || "").trim().toLowerCase()
  const out = records.filter(record => {
    if (from && record.createdAt < from) return false
    if (to && record.createdAt > to) return false
    if (filter.providerId && record.providerId !== filter.providerId) return false
    if (filter.modelId && record.modelId !== filter.modelId) return false
    if (filter.agentId && record.agentId !== filter.agentId) return false
    if (filter.source && filter.source !== "all" && record.source !== filter.source) return false
    if (filter.status && filter.status !== "all" && record.status !== filter.status) return false
    if (query) {
      const haystack = [
        record.providerId,
        record.modelId,
        record.agentId,
        record.promptPreview,
        record.responsePreview
      ].filter(Boolean).join(" ").toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const sortBy = filter.sortBy || "createdAt"
  const dir = filter.sortDir === "asc" ? 1 : -1
  return out.sort((a, b) => {
    const av = sortBy === "tokens" ? a.totalTokens : sortBy === "cost" ? (a.costUsd ?? -1) : sortBy === "latencyMs" ? (a.latencyMs ?? -1) : a.createdAt
    const bv = sortBy === "tokens" ? b.totalTokens : sortBy === "cost" ? (b.costUsd ?? -1) : sortBy === "latencyMs" ? (b.latencyMs ?? -1) : b.createdAt
    return (av - bv) * dir
  })
}

function turnsForUsageRecords(records: UsageRequestRecord[]): WorkbenchTurn[] {
  if (records.length === 0) return []
  const turnIds = new Set(records.map(record => record.turnId))
  const runtime = getWorkbenchRuntimeStore()
  const snapshot = runtime.snapshot(undefined)
  return snapshot.turns.filter(turn => turnIds.has(turn.id))
}

function usageTokensByTurn(records: UsageRequestRecord[]): Map<string, UsageBucket> {
  const map = new Map<string, UsageBucket>()
  for (const record of records) {
    const prev = map.get(record.turnId) || emptyUsageBucket()
    map.set(record.turnId, addRecordToBucket(prev, record))
  }
  return map
}

function modelRows(records: UsageRequestRecord[]): UsageModelRow[] {
  const rows = new Map<string, UsageBucket & { modelId: string; providerId?: string; agentId?: string }>()
  for (const record of records) {
    const key = `${record.providerId || "provider"}:${record.agentId || "agent"}:${record.modelId}`
    const row = rows.get(key) || { ...emptyUsageBucket(), modelId: record.modelId, providerId: record.providerId, agentId: record.agentId }
    addRecordToBucket(row, record)
    rows.set(key, row)
  }
  return [...rows.values()]
    .map(bucketToModelRow)
    .sort((a, b) => b.tokens - a.tokens)
}

function providerRows(records: UsageRequestRecord[]): UsageProviderRow[] {
  const rows = new Map<string, UsageBucket & { providerId: string }>()
  for (const record of records) {
    const row = rows.get(record.providerId) || { ...emptyUsageBucket(), providerId: record.providerId }
    addRecordToBucket(row, record)
    rows.set(record.providerId, row)
  }
  return [...rows.values()]
    .map(bucketToProviderRow)
    .sort((a, b) => b.tokens - a.tokens)
}

function buildHeatmap(turns: WorkbenchTurn[], usageByTurn: Map<string, UsageBucket>, range: UsageRange): UsageHeatmapDay[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 119
  const today = startOfDay(Date.now())
  const byDate = new Map<string, UsageBucket & { turns: number }>()
  for (const turn of turns) {
    const date = isoDay(turn.createdAt)
    const cur = byDate.get(date) || { ...emptyUsageBucket(), turns: 0 }
    const turnUsage = usageByTurn.get(turn.id) || emptyUsageBucket()
    cur.turns += 1
    mergeBucket(cur, turnUsage)
    byDate.set(date, cur)
  }
  const maxTokens = Math.max(1, ...[...byDate.values()].map(day => day.tokens))
  const out: UsageHeatmapDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const ts = today - i * DAY_MS
    const date = isoDay(ts)
    const value = byDate.get(date) || { ...emptyUsageBucket(), turns: 0 }
    out.push({
      date,
      turns: value.turns,
      tokens: value.tokens,
      actualTokens: value.actualTokens,
      estimatedTokens: value.estimatedTokens,
      hasEstimated: value.hasEstimated,
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
      cacheReadTokens: value.cacheReadTokens,
      cacheCreationTokens: value.cacheCreationTokens,
      cacheSavingsTokens: value.cacheSavingsTokens,
      costUsd: value.costUsd,
      hasUnpriced: value.hasUnpriced,
      level: heatLevel(value.tokens, value.turns, maxTokens),
      selected: i === 0
    })
  }
  return out
}

function bucketToModelRow(bucket: UsageBucket & { modelId: string; providerId?: string; agentId?: string }): UsageModelRow {
  return {
    modelId: bucket.modelId,
    providerId: bucket.providerId,
    agentId: bucket.agentId,
    turns: bucket.turnIds.size,
    requests: bucket.requests,
    tokens: bucket.tokens,
    actualTokens: bucket.actualTokens,
    estimatedTokens: bucket.estimatedTokens,
    hasEstimated: bucket.hasEstimated,
    inputTokens: bucket.inputTokens,
    outputTokens: bucket.outputTokens,
    cacheReadTokens: bucket.cacheReadTokens,
    cacheCreationTokens: bucket.cacheCreationTokens,
    cacheSavingsTokens: bucket.cacheSavingsTokens,
    costUsd: bucket.costUsd,
    hasUnpriced: bucket.hasUnpriced
  }
}

function bucketToProviderRow(bucket: UsageBucket & { providerId: string }): UsageProviderRow {
  return {
    providerId: bucket.providerId,
    turns: bucket.turnIds.size,
    requests: bucket.requests,
    tokens: bucket.tokens,
    actualTokens: bucket.actualTokens,
    estimatedTokens: bucket.estimatedTokens,
    hasEstimated: bucket.hasEstimated,
    inputTokens: bucket.inputTokens,
    outputTokens: bucket.outputTokens,
    cacheReadTokens: bucket.cacheReadTokens,
    cacheCreationTokens: bucket.cacheCreationTokens,
    cacheSavingsTokens: bucket.cacheSavingsTokens,
    costUsd: bucket.costUsd,
    hasUnpriced: bucket.hasUnpriced
  }
}

function addRecordToBucket<T extends UsageBucket>(bucket: T, record: UsageRequestRecord): T {
  bucket.tokens += record.totalTokens
  bucket.actualTokens += record.actualTokens
  bucket.estimatedTokens += record.estimatedTokens
  bucket.hasEstimated = bucket.hasEstimated || record.hasEstimated
  bucket.inputTokens += record.inputTokens
  bucket.outputTokens += record.outputTokens
  bucket.cacheReadTokens += record.cacheReadTokens
  bucket.cacheCreationTokens += record.cacheCreationTokens
  bucket.cacheSavingsTokens += record.cacheReadTokens
  bucket.billableInputTokens += record.billableInputTokens
  bucket.inputSurfaceTokens += record.inputSurfaceTokens ?? inputSurfaceTokens(record.inputTokens, record.cacheReadTokens, inputIncludesCacheRead(record.providerId, record.modelId))
  bucket.requests += 1
  bucket.turnIds.add(record.turnId)
  if (record.costUsd == null && record.hasUnpriced && record.totalTokens > 0) {
    bucket.hasUnpriced = true
  }
  if (record.costUsd != null) {
    bucket.costUsd = (bucket.costUsd ?? 0) + record.costUsd
  }
  return bucket
}

function mergeBucket<T extends UsageBucket>(target: T, source: UsageBucket): T {
  target.tokens += source.tokens
  target.actualTokens += source.actualTokens
  target.estimatedTokens += source.estimatedTokens
  target.hasEstimated = target.hasEstimated || source.hasEstimated
  target.inputTokens += source.inputTokens
  target.outputTokens += source.outputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheCreationTokens += source.cacheCreationTokens
  target.cacheSavingsTokens += source.cacheSavingsTokens
  target.billableInputTokens += source.billableInputTokens
  target.inputSurfaceTokens += source.inputSurfaceTokens
  target.requests += source.requests
  for (const turnId of source.turnIds) target.turnIds.add(turnId)
  if (source.hasUnpriced) target.hasUnpriced = true
  if (source.costUsd != null) target.costUsd = (target.costUsd ?? 0) + source.costUsd
  return target
}

function emptyUsageBucket(): UsageBucket {
  return {
    tokens: 0,
    actualTokens: 0,
    estimatedTokens: 0,
    hasEstimated: false,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    cacheSavingsTokens: 0,
    billableInputTokens: 0,
    inputSurfaceTokens: 0,
    costUsd: null,
    hasUnpriced: false,
    requests: 0,
    turnIds: new Set<string>()
  }
}

function priceUsage(providerId: string, modelId: string, usage: UsageTokenBreakdown): { costUsd: number | null; hasUnpriced: boolean } {
  const rule = findPricingRule(providerId, modelId)
  if (!rule) return { costUsd: null, hasUnpriced: true }
  const billableInput = billableInputTokens(providerId, modelId, usage)
  const cacheReadPrice = rule.cacheReadUsdPerMillion ?? 0
  const cacheCreationPrice = rule.cacheCreationUsdPerMillion ?? rule.inputUsdPerMillion
  const costUsd =
    billableInput / 1_000_000 * rule.inputUsdPerMillion +
    usage.outputTokens / 1_000_000 * rule.outputUsdPerMillion +
    usage.cacheReadTokens / 1_000_000 * cacheReadPrice +
    usage.cacheCreationTokens / 1_000_000 * cacheCreationPrice
  return { costUsd, hasUnpriced: false }
}

function billableInputTokens(providerId: string, modelId: string, usage: UsageTokenBreakdown): number {
  const explicit = Number(usage.billableInputTokens)
  if (Number.isFinite(explicit) && explicit >= 0) return Math.round(explicit)
  const cacheReadInputIncluded = usage.cacheReadInputIncluded ?? inputIncludesCacheRead(providerId, modelId)
  if (cacheReadInputIncluded) return Math.max(usage.inputTokens - usage.cacheReadTokens, 0)
  return usage.inputTokens
}

function inputIncludesCacheRead(providerId: string, modelId: string): boolean {
  const key = `${providerId} ${modelId}`.toLowerCase()
  if (key.includes("anthropic") || key.includes("claude")) return false
  return key.includes("openai") || key.includes("codex") || key.includes("gemini") || key.includes("deepseek") || key.includes("openrouter") || key.includes("provider:")
}

function findPricingRule(providerId: string, modelId: string): UsagePricingRule | undefined {
  const rules = pricingState().rules
  return rules.find(rule => rule.providerId === providerId && rule.modelId === modelId)
    || rules.find(rule => !rule.providerId && rule.modelId === modelId)
}

function pricingState(): PricingState {
  const raw = store.get(PRICING_KEY)
  if (raw && typeof raw === "object" && Array.isArray((raw as any).rules)) {
    return {
      version: 1,
      rules: (raw as any).rules
        .map(normalizePricingRule)
        .filter((rule: UsagePricingRule | null): rule is UsagePricingRule => Boolean(rule))
    }
  }
  return { version: 1, rules: [] }
}

function savePricingState(state: PricingState): void {
  store.set(PRICING_KEY, { version: 1, rules: state.rules })
}

function normalizePricingRule(raw: any): UsagePricingRule | null {
  if (!raw || typeof raw !== "object" || !raw.modelId) return null
  const providerId = normalizeOptionalString(raw.providerId)
  const modelId = String(raw.modelId)
  const now = Date.now()
  return {
    id: normalizeOptionalString(raw.id) || pricingRuleId(providerId, modelId),
    providerId,
    modelId,
    displayName: normalizeOptionalString(raw.displayName),
    inputUsdPerMillion: nonNegativeNumber(raw.inputUsdPerMillion),
    outputUsdPerMillion: nonNegativeNumber(raw.outputUsdPerMillion),
    cacheReadUsdPerMillion: optionalNonNegativeNumber(raw.cacheReadUsdPerMillion),
    cacheCreationUsdPerMillion: optionalNonNegativeNumber(raw.cacheCreationUsdPerMillion),
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now
  }
}

function pricingRuleId(providerId: string | undefined, modelId: string): string {
  return `${providerId || "any"}:${modelId}`
}

function providerIdForEvent(event: RuntimeEvent): string {
  const explicit = normalizeOptionalString(event.payload?.providerId)
  if (explicit) return explicit
  const agentId = normalizeOptionalString(event.agentId || event.payload?.agentId)
  if (agentId?.startsWith("provider:")) return agentId.slice("provider:".length)
  return "local-cli"
}

function modelIdForEvent(event: RuntimeEvent, usageModelId?: string): string {
  return String(usageModelId || event.payload?.modelId || event.payload?.requestModelId || "unknown")
}

function geminiOutputFromTotal(raw: any, inputTokens: number, reportedTotal?: number): number | null {
  const hasGeminiTotal = reportedTotal != null && (
    raw.totalTokenCount != null ||
    raw.total_token_count != null ||
    raw.usageMetadata?.totalTokenCount != null
  )
  if (!hasGeminiTotal) return null
  return Math.max(reportedTotal - inputTokens, 0)
}

function heatLevel(tokens: number, turns: number, maxTokens: number): UsageHeatmapDay["level"] {
  if (tokens <= 0 && turns <= 0) return 0
  if (tokens <= 0) return 1
  const ratio = tokens / maxTokens
  if (ratio > 0.75) return 4
  if (ratio > 0.45) return 3
  if (ratio > 0.18) return 2
  return 1
}

function currentStreak(activeDays: Set<string>): number {
  let streak = 0
  let cursor = startOfDay(Date.now())
  while (activeDays.has(isoDay(cursor))) {
    streak += 1
    cursor -= DAY_MS
  }
  return streak
}

function longestStreak(activeDays: Set<string>): number {
  const days = [...activeDays].sort()
  let longest = 0
  let current = 0
  let prev = 0
  for (const day of days) {
    const ts = new Date(`${day}T00:00:00`).getTime()
    current = prev && ts - prev === DAY_MS ? current + 1 : 1
    longest = Math.max(longest, current)
    prev = ts
  }
  return longest
}

function rangeStart(range: UsageRange): number | null {
  if (range === "all") return null
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  return startOfDay(Date.now()) - (days - 1) * DAY_MS
}

function cacheRate(bucket: UsageBucket): number | null {
  if (bucket.inputTokens <= 0 && bucket.cacheReadTokens <= 0) return null
  const totalInputSurface = bucket.inputSurfaceTokens || inputSurfaceTokens(bucket.inputTokens, bucket.cacheReadTokens, false)
  return totalInputSurface > 0 ? bucket.cacheReadTokens / totalInputSurface : null
}

function inputSurfaceTokens(inputTokens: number, cacheReadTokens: number, cacheReadInputIncluded: boolean): number {
  return cacheReadInputIncluded ? Math.max(inputTokens, cacheReadTokens) : inputTokens + cacheReadTokens
}

function estimateTokens(text: string): number {
  const chars = text.replace(/\s+/g, " ").trim().length
  return chars > 0 ? Math.ceil(chars / CHARS_PER_TOKEN) : 0
}

function previewText(value: any): string | undefined {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
  return text ? text.slice(0, 240) : undefined
}

function firstNumber(...values: any[]): number | null {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n))
  }
  return null
}

function cacheReadAlreadyInInput(raw: any): boolean {
  const original = raw?.raw && typeof raw.raw === "object" ? raw.raw : raw
  return Boolean(
    original?.prompt_tokens_details?.cached_tokens != null ||
    original?.input_tokens_details?.cached_tokens != null ||
    original?.inputTokensDetails?.cachedTokens != null ||
    original?.cachedContentTokenCount != null ||
    original?.cached_content_token_count != null
  )
}

function nonNegativeNumber(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function optionalNonNegativeNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  return nonNegativeNumber(value)
}

function optionalPositiveNumber(value: any): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function normalizeOptionalString(value: any): string | undefined {
  const text = typeof value === "string" ? value.trim() : ""
  return text || undefined
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isoDay(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
