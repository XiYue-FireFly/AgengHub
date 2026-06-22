/**
 * TaskRecovery: persist and recover long-running task state.
 *
 * Tracks active tasks across restarts. On startup, marks interrupted
 * tasks as 'interrupted' with recovery info. Provides UI with
 * recoverable task list.
 *
 * P3-5: Long task recovery.
 */

import { store } from '../store'

const STORAGE_KEY = 'task.recovery.v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export type TaskRecoveryStatus = 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled'

export interface RecoverableTask {
  id: string
  threadId?: string
  turnId?: string
  workflowId?: string
  title: string
  status: TaskRecoveryStatus
  /** Why the task ended (or was interrupted) */
  reason?: string
  /** Whether the task can be retried */
  recoverable: boolean
  startedAt: string
  updatedAt: string
}

function readTasks(): RecoverableTask[] {
  const raw: any = store.get(STORAGE_KEY)
  return Array.isArray(raw) ? raw : []
}

function writeTasks(tasks: RecoverableTask[]): void {
  // Prune old tasks
  const cutoff = Date.now() - MAX_AGE_MS
  const pruned = tasks.filter(t => new Date(t.updatedAt).getTime() > cutoff)
  store.set(STORAGE_KEY, pruned)
}

/** Register a new running task. */
export function registerTask(task: Omit<RecoverableTask, 'startedAt' | 'updatedAt'>): void {
  const tasks = readTasks()
  const existing = tasks.findIndex(t => t.id === task.id)
  const now = new Date().toISOString()
  const entry: RecoverableTask = { ...task, startedAt: now, updatedAt: now }
  if (existing >= 0) tasks[existing] = entry
  else tasks.push(entry)
  writeTasks(tasks)
}

/** Mark a task as completed/failed/cancelled. */
export function updateTaskStatus(id: string, status: TaskRecoveryStatus, reason?: string): void {
  const tasks = readTasks()
  const task = tasks.find(t => t.id === id)
  if (task) {
    task.status = status
    task.reason = reason
    task.updatedAt = new Date().toISOString()
    task.recoverable = status === 'failed' || status === 'interrupted'
    writeTasks(tasks)
  }
}

/** On startup: mark all 'running' tasks as 'interrupted'. */
export function recoverInterruptedTasks(): RecoverableTask[] {
  const tasks = readTasks()
  const interrupted: RecoverableTask[] = []
  for (const task of tasks) {
    if (task.status === 'running') {
      task.status = 'interrupted'
      task.reason = 'Task was interrupted by app restart'
      task.recoverable = true
      task.updatedAt = new Date().toISOString()
      interrupted.push(task)
    }
  }
  if (interrupted.length > 0) writeTasks(tasks)
  return interrupted
}

/** Get all recoverable tasks. */
export function getRecoverableTasks(): RecoverableTask[] {
  return readTasks().filter(t => t.recoverable)
}

/** Get task by ID. */
export function getTask(id: string): RecoverableTask | null {
  return readTasks().find(t => t.id === id) || null
}

/** Clean up old completed tasks. */
export function cleanupOldTasks(): number {
  const tasks = readTasks()
  const cutoff = Date.now() - MAX_AGE_MS
  const before = tasks.length
  const pruned = tasks.filter(t =>
    t.status === 'running' || new Date(t.updatedAt).getTime() > cutoff
  )
  writeTasks(pruned)
  return before - pruned.length
}
