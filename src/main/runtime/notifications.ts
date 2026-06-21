/**
 * Notification Center: in-app notification system.
 *
 * Aggregates notifications from various subsystems (task completion,
 * approval pending, MCP disconnected, etc.) into a unified inbox.
 * Notifications are persisted for 7 days, then auto-pruned.
 */

import { store } from '../store'

const STORAGE_KEY = 'notifications.inbox.v1'
const MAX_NOTIFICATIONS = 200
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export type NotificationCategory = 'task' | 'approval' | 'mcp' | 'system' | 'workflow' | 'memory' | 'error'

export interface Notification {
  id: string
  title: string
  body: string
  category: NotificationCategory
  /** Whether the user has read this notification */
  read: boolean
  /** Optional action: jump to a specific page/section */
  action?: { type: 'navigate'; target: string } | { type: 'open-url'; url: string }
  createdAt: string
}

export interface NotificationInbox {
  version: 1
  notifications: Notification[]
}

function emptyInbox(): NotificationInbox { return { version: 1, notifications: [] } }

function readInbox(): NotificationInbox {
  const raw: any = store.get(STORAGE_KEY)
  if (!raw || typeof raw !== 'object') return emptyInbox()
  const notifications = Array.isArray(raw.notifications) ? raw.notifications.filter((n: any) => n?.id) : []
  return { version: 1, notifications }
}

function writeInbox(inbox: NotificationInbox): void {
  // Prune old notifications
  const cutoff = Date.now() - PRUNE_AFTER_MS
  inbox.notifications = inbox.notifications
    .filter(n => new Date(n.createdAt).getTime() > cutoff)
    .slice(0, MAX_NOTIFICATIONS)
  store.set(STORAGE_KEY, inbox)
}

export function listNotifications(unreadOnly = false): Notification[] {
  const inbox = readInbox()
  return unreadOnly ? inbox.notifications.filter(n => !n.read) : inbox.notifications
}

export function getUnreadCount(): number {
  return readInbox().notifications.filter(n => !n.read).length
}

export function pushNotification(input: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
  const inbox = readInbox()
  const notification: Notification = {
    id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...input
  }
  inbox.notifications.unshift(notification)
  writeInbox(inbox)
  return notification
}

export function markRead(id: string): boolean {
  const inbox = readInbox()
  const n = inbox.notifications.find(item => item.id === id)
  if (!n) return false
  n.read = true
  writeInbox(inbox)
  return true
}

export function markAllRead(): number {
  const inbox = readInbox()
  let count = 0
  for (const n of inbox.notifications) {
    if (!n.read) { n.read = true; count++ }
  }
  if (count > 0) writeInbox(inbox)
  return count
}

export function deleteNotification(id: string): boolean {
  const inbox = readInbox()
  const before = inbox.notifications.length
  inbox.notifications = inbox.notifications.filter(n => n.id !== id)
  if (inbox.notifications.length !== before) { writeInbox(inbox); return true }
  return false
}

export function clearAllNotifications(): void {
  store.set(STORAGE_KEY, emptyInbox())
}
