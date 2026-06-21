/**
 * BudgetCenter: budget management for API usage.
 *
 * Tracks daily/monthly spending, enforces per-request limits,
 * and suggests cheaper alternatives when budget is exceeded.
 *
 * P4-F2: Budget Center.
 */

import { store } from '../store'

const BUDGET_KEY = 'budget.config.v1'

export interface BudgetConfig {
  version: 1
  dailyLimitUsd: number | null
  monthlyLimitUsd: number | null
  perRequestMaxTokens: number | null
  perRequestMaxCostUsd: number | null
  notifyAtPercent: number // 0-100, default 80
  blockWhenExceeded: boolean
  suggestCheaperModel: boolean
}

const DEFAULT_CONFIG: BudgetConfig = {
  version: 1,
  dailyLimitUsd: null,
  monthlyLimitUsd: null,
  perRequestMaxTokens: null,
  perRequestMaxCostUsd: null,
  notifyAtPercent: 80,
  blockWhenExceeded: false,
  suggestCheaperModel: true
}

export function getBudgetConfig(): BudgetConfig {
  const raw: any = store.get(BUDGET_KEY)
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...raw, version: 1 as const }
}

export function updateBudgetConfig(patch: Partial<BudgetConfig>): BudgetConfig {
  const current = getBudgetConfig()
  const next: BudgetConfig = { ...current, ...patch, version: 1 }
  store.set(BUDGET_KEY, next)
  return next
}

/**
 * Check if a request would exceed budget limits.
 */
export function checkBudget(
  config: BudgetConfig,
  dailySpentUsd: number,
  monthlySpentUsd: number,
  requestTokens: number
): { allowed: boolean; reason?: string; warning?: string } {
  // Per-request token limit
  if (config.perRequestMaxTokens && requestTokens > config.perRequestMaxTokens) {
    return { allowed: !config.blockWhenExceeded, reason: `Request exceeds ${config.perRequestMaxTokens} token limit` }
  }
  // Daily budget
  if (config.dailyLimitUsd) {
    if (dailySpentUsd >= config.dailyLimitUsd) {
      return { allowed: !config.blockWhenExceeded, reason: `Daily budget ($${config.dailyLimitUsd}) exceeded` }
    }
    if (dailySpentUsd >= config.dailyLimitUsd * (config.notifyAtPercent / 100)) {
      return { allowed: true, warning: `Approaching daily budget: $${dailySpentUsd.toFixed(2)} / $${config.dailyLimitUsd}` }
    }
  }
  // Monthly budget
  if (config.monthlyLimitUsd) {
    if (monthlySpentUsd >= config.monthlyLimitUsd) {
      return { allowed: !config.blockWhenExceeded, reason: `Monthly budget ($${config.monthlyLimitUsd}) exceeded` }
    }
    if (monthlySpentUsd >= config.monthlyLimitUsd * (config.notifyAtPercent / 100)) {
      return { allowed: true, warning: `Approaching monthly budget: $${monthlySpentUsd.toFixed(2)} / $${config.monthlyLimitUsd}` }
    }
  }
  return { allowed: true }
}
