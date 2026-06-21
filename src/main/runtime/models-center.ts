/**
 * ModelsCenter: unified model management across providers.
 *
 * Provides model health, capabilities, pricing, favorites, and usage stats
 * in a single view. Builds on existing provider/model infrastructure.
 *
 * P4-F1: Models Center.
 */

import { store } from '../store'

const FAVORITES_KEY = 'models.favorites.v1'
const HIDDEN_KEY = 'models.hidden.v1'

export interface ModelInfo {
  providerId: string
  providerName: string
  modelId: string
  label: string
  contextWindow: number
  supportsTools: boolean
  supportsVision: boolean
  supportsThinking: boolean
  isFavorite: boolean
  isHidden: boolean
}

export function getModelFavorites(): Set<string> {
  const raw: any = store.get(FAVORITES_KEY)
  return new Set(Array.isArray(raw) ? raw : [])
}

export function toggleModelFavorite(providerId: string, modelId: string): boolean {
  const favs = getModelFavorites()
  const key = `${providerId}/${modelId}`
  if (favs.has(key)) { favs.delete(key) } else { favs.add(key) }
  store.set(FAVORITES_KEY, [...favs])
  return favs.has(key)
}

export function getModelHidden(): Set<string> {
  const raw: any = store.get(HIDDEN_KEY)
  return new Set(Array.isArray(raw) ? raw : [])
}

export function toggleModelHidden(providerId: string, modelId: string): boolean {
  const hidden = getModelHidden()
  const key = `${providerId}/${modelId}`
  if (hidden.has(key)) { hidden.delete(key) } else { hidden.add(key) }
  store.set(HIDDEN_KEY, [...hidden])
  return hidden.has(key)
}

/**
 * Build a unified model list from all enabled providers.
 */
export function buildModelList(providers: Array<{ id: string; name: string; enabled: boolean; apiKey?: string; models: Array<{ id: string; label: string; contextWindow?: number; supportsTools?: boolean; supportsVision?: boolean; supportsThinking?: boolean }> }>): ModelInfo[] {
  const favs = getModelFavorites()
  const hidden = getModelHidden()
  const result: ModelInfo[] = []
  for (const provider of providers) {
    if (!provider.enabled || !provider.apiKey) continue
    for (const model of provider.models) {
      const key = `${provider.id}/${model.id}`
      result.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId: model.id,
        label: model.label || model.id,
        contextWindow: model.contextWindow || 128_000,
        supportsTools: model.supportsTools || false,
        supportsVision: model.supportsVision || false,
        supportsThinking: model.supportsThinking || false,
        isFavorite: favs.has(key),
        isHidden: hidden.has(key)
      })
    }
  }
  // Sort: favorites first, then by provider+model
  return result.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return `${a.providerName}/${a.label}`.localeCompare(`${b.providerName}/${b.label}`)
  })
}
