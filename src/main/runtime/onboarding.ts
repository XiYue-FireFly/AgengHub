/**
 * Onboarding: first-run guided experience.
 *
 * Tracks onboarding progress so the welcome flow is shown only once.
 * Users can skip any step, and the onboarding can be re-triggered
 * from Settings.
 */

import { store } from '../store'

const STORAGE_KEY = 'onboarding.v1'

export type OnboardingStep =
  | 'select-language'
  | 'bind-provider'
  | 'detect-agents'
  | 'choose-default-agent'
  | 'test-mcp'
  | 'enable-skills'
  | 'create-workspace'
  | 'send-first-message'

export interface OnboardingState {
  version: 1
  /** Whether the onboarding has been completed (all steps done or skipped) */
  completed: boolean
  /** ISO timestamp when onboarding was completed */
  completedAt?: string
  /** Steps that have been completed or skipped */
  completedSteps: OnboardingStep[]
  /** Steps that were explicitly skipped (subset of completedSteps) */
  skippedSteps: OnboardingStep[]
}

const ALL_STEPS: OnboardingStep[] = [
  'select-language',
  'bind-provider',
  'detect-agents',
  'choose-default-agent',
  'test-mcp',
  'enable-skills',
  'create-workspace',
  'send-first-message'
]

function defaultState(): OnboardingState {
  return { version: 1, completed: false, completedSteps: [], skippedSteps: [] }
}

function readState(): OnboardingState {
  const raw: any = store.get(STORAGE_KEY)
  if (!raw || typeof raw !== 'object') return defaultState()
  return {
    version: 1,
    completed: !!raw.completed,
    completedAt: raw.completedAt || undefined,
    completedSteps: Array.isArray(raw.completedSteps) ? raw.completedSteps : [],
    skippedSteps: Array.isArray(raw.skippedSteps) ? raw.skippedSteps : []
  }
}

function writeState(state: OnboardingState): void {
  store.set(STORAGE_KEY, state)
}

export function getOnboardingState(): OnboardingState {
  return readState()
}

export function shouldShowOnboarding(): boolean {
  const state = readState()
  // Show if not completed AND no existing config that suggests a returning user
  return !state.completed
}

export function completeStep(step: OnboardingStep, skipped = false): OnboardingState {
  const state = readState()
  if (!state.completedSteps.includes(step)) {
    state.completedSteps.push(step)
  }
  if (skipped && !state.skippedSteps.includes(step)) {
    state.skippedSteps.push(step)
  }
  // Check if all steps are completed
  if (ALL_STEPS.every(s => state.completedSteps.includes(s))) {
    state.completed = true
    state.completedAt = new Date().toISOString()
  }
  writeState(state)
  return state
}

export function skipAllOnboarding(): void {
  const state: OnboardingState = {
    version: 1,
    completed: true,
    completedAt: new Date().toISOString(),
    completedSteps: [...ALL_STEPS],
    skippedSteps: [...ALL_STEPS]
  }
  writeState(state)
}

export function resetOnboarding(): void {
  writeState(defaultState())
}

export function getNextStep(): OnboardingStep | null {
  const state = readState()
  return ALL_STEPS.find(s => !state.completedSteps.includes(s)) || null
}

export function getStepIndex(step: OnboardingStep): number {
  return ALL_STEPS.indexOf(step)
}

export function getTotalSteps(): number {
  return ALL_STEPS.length
}
