export type ContextCapacityCategoryKey = 'system' | 'messages' | 'attachments' | 'skills' | 'workspace'
export type ContextCapacityTone = 'ok' | 'warn' | 'danger'
export type ContextCapacityCategory = { key: ContextCapacityCategoryKey; tokens: number; ratio: number }

export interface ContextCapacityResult {
  windowTokens: number
  usedTokens: number
  freeTokens: number
  usedRatio: number
  tone: ContextCapacityTone
  categories: ContextCapacityCategory[]
}

export interface ContextCapacityInput {
  turns: Array<Pick<WorkbenchTurn, 'prompt'>>
  events: Array<Pick<RuntimeEvent, 'kind' | 'payload'>>
  attachments: Array<Pick<WorkbenchAttachment, 'text' | 'name' | 'path'>>
  draftText?: string
  workspaceBound: boolean
  modelSelection: ModelSelection | null
  providers: Array<{ id: string; models?: Array<{ id: string; contextWindow?: number }> }>
}

export function buildContextCapacity(input: ContextCapacityInput): ContextCapacityResult {
  const windowTokens = resolveContextWindow(input.modelSelection, input.providers)
  const system = 1800
  const skills = 420
  const workspace = input.workspaceBound ? 900 : 80
  const messages = estimateContextTokens(input.turns.map(turn => turn.prompt).join('\n\n')) +
    estimateContextTokens(input.events.filter(event => event.kind === 'agent:done' && event.payload?.visibility !== 'run').map(event => event.payload?.content || '').join('\n\n')) +
    estimateContextTokens(input.draftText || '')
  const attachments = input.attachments.reduce((sum, item) => sum + estimateContextTokens(item.text || item.name || item.path || ''), 0)
  const rawCategories: Array<{ key: ContextCapacityCategoryKey; tokens: number }> = [
    { key: 'system', tokens: system },
    { key: 'messages', tokens: messages },
    { key: 'attachments', tokens: attachments },
    { key: 'skills', tokens: skills },
    { key: 'workspace', tokens: workspace }
  ]
  const rawTotal = rawCategories.reduce((sum, item) => sum + item.tokens, 0)
  const usedTokens = Math.min(windowTokens, rawTotal)
  const scale = usedTokens > 0 ? usedTokens / Math.max(usedTokens, rawTotal) : 1
  const categories = rawCategories.map(item => ({
    key: item.key,
    tokens: Math.round(item.tokens * scale),
    ratio: Math.max(0, Math.round(item.tokens * scale) / windowTokens)
  }))
  const usedRatio = usedTokens / windowTokens
  return {
    windowTokens,
    usedTokens,
    freeTokens: Math.max(0, windowTokens - usedTokens),
    usedRatio,
    tone: usedRatio >= 0.85 ? 'danger' : usedRatio >= 0.75 ? 'warn' : 'ok',
    categories
  }
}

export function resolveContextWindow(selection: ModelSelection | null, providers: ContextCapacityInput['providers']): number {
  if (selection?.providerId) {
    const provider = providers.find(item => item.id === selection.providerId)
    const model = provider?.models?.find(item => item.id === selection.modelId)
    const contextWindow = model?.contextWindow
    if (typeof contextWindow === 'number' && contextWindow > 0) return contextWindow
  }
  return 258_000
}

export function estimateContextTokens(value: string): number {
  const text = String(value || '')
  if (!text) return 0
  let cjk = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if ((code >= 0x3400 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff)) cjk += 1
  }
  return Math.ceil(cjk * 0.9 + (text.length - cjk) / 4)
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
  return String(tokens)
}

export function formatCompactTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return String(value)
}
