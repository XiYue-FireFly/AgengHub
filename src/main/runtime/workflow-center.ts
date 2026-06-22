/**
 * WorkflowCenter: enhanced workflow execution and management.
 *
 * Extends workflow-runner with step-level execution context,
 * variable substitution, conditional branching, and execution history.
 *
 * P4-F4: Workflow Center.
 */

import { store } from '../store'

const HISTORY_KEY = 'workflow.history.v1'
const MAX_HISTORY = 100

export interface WorkflowVariable {
  name: string
  value: string
  type: 'string' | 'number' | 'boolean'
}

export interface WorkflowExecutionContext {
  variables: WorkflowVariable[]
  currentStepId: string | null
  outputs: Map<string, string>
}

export interface WorkflowRunRecord {
  workflowId: string
  runId: string
  workflowName: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  stepResults: Array<{ stepId: string; status: string; output?: string; error?: string }>
}

/**
 * Substitute {{variable}} placeholders in a string.
 */
export function substituteVariables(template: string, vars: WorkflowVariable[]): string {
  let result = template
  for (const v of vars) {
    result = result.replaceAll(`{{${v.name}}}`, String(v.value))
  }
  return result
}

/**
 * Evaluate a simple condition expression.
 * Supports: {{var}} == "value", {{var}} != "value", {{var}} > 0, etc.
 */
export function evaluateCondition(condition: string, vars: WorkflowVariable[]): boolean {
  const substituted = substituteVariables(condition, vars)
  try {
    // Safe evaluation: only allow simple comparisons
    const match = substituted.match(/^(\S+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/)
    if (!match) return true // no condition = always true
    const [, left, op, right] = match
    const leftNum = Number(left)
    const rightNum = Number(right)
    const rightStr = right.replace(/^["']|["']$/g, '')
    switch (op) {
      case '==': return left === rightStr || leftNum === rightNum
      case '!=': return left !== rightStr && leftNum !== rightNum
      case '>': return leftNum > rightNum
      case '<': return leftNum < rightNum
      case '>=': return leftNum >= rightNum
      case '<=': return leftNum <= rightNum
      default: return true
    }
  } catch { return true }
}

/**
 * Save a workflow run record to history.
 */
export function saveRunRecord(record: WorkflowRunRecord): void {
  const history = loadRunHistory()
  history.unshift(record)
  if (history.length > MAX_HISTORY) history.pop()
  store.set(HISTORY_KEY, history)
}

/**
 * Load workflow run history.
 */
export function loadRunHistory(): WorkflowRunRecord[] {
  const raw: any = store.get(HISTORY_KEY)
  return Array.isArray(raw) ? raw : []
}

/**
 * Get run history for a specific workflow.
 */
export function getWorkflowRunHistory(workflowId: string): WorkflowRunRecord[] {
  return loadRunHistory().filter(r => r.workflowId === workflowId)
}
