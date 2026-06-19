import { store } from "../store"
import type { WorkbenchGoal } from "./types"

const GOALS_KEY = "runtime.workbench.goals.v1"
const DEFAULT_LOOP_LIMIT = 5
const MAX_GOAL_LENGTH = 4000

interface GoalState {
  version: 1
  goals: Record<string, WorkbenchGoal>
}

export function getWorkbenchGoal(threadId: string | null | undefined): WorkbenchGoal | null {
  if (!threadId) return null
  const goal = loadState().goals[threadId]
  return goal && goal.status === "active" ? goal : null
}

export function setWorkbenchGoal(threadId: string, goal: string, loopLimit = DEFAULT_LOOP_LIMIT): WorkbenchGoal {
  const clean = String(goal || "").trim().slice(0, MAX_GOAL_LENGTH)
  if (!threadId) throw new Error("threadId is required")
  if (!clean) throw new Error("goal is required")
  const state = loadState()
  const now = Date.now()
  const existing = state.goals[threadId]
  const next: WorkbenchGoal = {
    threadId,
    goal: clean,
    loopLimit: clampLoopLimit(loopLimit || existing?.loopLimit || DEFAULT_LOOP_LIMIT),
    status: "active",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  state.goals[threadId] = next
  saveState(state)
  return next
}

export function clearWorkbenchGoal(threadId: string): WorkbenchGoal | null {
  const state = loadState()
  const existing = state.goals[threadId]
  if (!existing) return null
  const next: WorkbenchGoal = { ...existing, status: "cleared", updatedAt: Date.now() }
  state.goals[threadId] = next
  saveState(state)
  return next
}

export function parseLoopLimit(raw: string | undefined, fallback = DEFAULT_LOOP_LIMIT): number {
  if (!raw) return fallback
  const match = raw.match(/(?:--?(?:n|times|limit|max))\s*[=:]?\s*(\d{1,2})/i)
  return clampLoopLimit(match ? Number(match[1]) : fallback)
}

export function shouldApplyGoalToPrompt(prompt: string): boolean {
  const text = String(prompt || "").trim()
  if (!text) return false
  if (/^\[AgentHub Loop\]/i.test(text)) return false
  if (/^\/(?:goal|loop)\b/i.test(text)) return false
  return true
}

export function promptWithGoalContext(prompt: string, goal: WorkbenchGoal | null | undefined): string {
  if (!goal || goal.status !== "active" || !shouldApplyGoalToPrompt(prompt)) return prompt
  return [
    "[AgentHub Thread Goal]",
    goal.goal,
    "",
    "Use this as the long-running direction for the conversation. Do not replace the user's current request; satisfy the current request first and keep the goal in mind.",
    "",
    "[Current User Request]",
    prompt
  ].join("\n")
}

function loadState(): GoalState {
  const raw = store.get(GOALS_KEY)
  if (raw && typeof raw === "object" && (raw as any).version === 1 && typeof (raw as any).goals === "object") {
    return { version: 1, goals: { ...(raw as any).goals } }
  }
  return { version: 1, goals: {} }
}

function saveState(state: GoalState): void {
  store.set(GOALS_KEY, state)
}

function clampLoopLimit(value: number): number {
  const n = Math.floor(Number(value) || DEFAULT_LOOP_LIMIT)
  return Math.max(1, Math.min(20, n))
}
