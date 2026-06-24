import { app, ipcMain } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const LOG_FILE = 'agenthub-events.jsonl'
let ipcInstalled = false

function logDir(): string {
  try {
    return join(app.getPath('userData'), 'logs')
  } catch {
    return join(process.cwd(), 'logs')
  }
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]'
  if (typeof value === 'string') {
    if (value.length > 240) return value.slice(0, 240) + '...'
    return value
  }
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 12).map(item => redact(item, depth + 1))
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/api[-_]?key|token|secret|password|authorization/i.test(key)) {
      result[key] = item ? '[redacted]' : item
    } else {
      result[key] = redact(item, depth + 1)
    }
  }
  return result
}

export function appendAppEventLog(kind: string, payload: Record<string, unknown> = {}): void {
  try {
    const dir = logDir()
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, LOG_FILE), JSON.stringify({
      ts: new Date().toISOString(),
      kind,
      ...(redact(payload) as Record<string, unknown>)
    }) + '\n', 'utf8')
  } catch {
    // Logging must never affect app behavior.
  }
}

export function appEventLogPath(): string {
  return join(logDir(), LOG_FILE)
}

export function installGlobalAppEventLogging(): void {
  if (ipcInstalled) return
  ipcInstalled = true
  appendAppEventLog('app:logger-installed', { path: appEventLogPath() })
  const originalHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = ((channel: string, listener: any) => {
    return originalHandle(channel, async (event: any, ...args: any[]) => {
      const startedAt = Date.now()
      appendAppEventLog('ipc:start', { channel, args })
      try {
        const result = await listener(event, ...args)
        appendAppEventLog('ipc:done', { channel, durationMs: Date.now() - startedAt })
        return result
      } catch (error: any) {
        appendAppEventLog('ipc:error', { channel, durationMs: Date.now() - startedAt, error: error?.message || String(error), stack: error?.stack })
        throw error
      }
    })
  }) as typeof ipcMain.handle

  process.on('uncaughtException', error => {
    appendAppEventLog('process:uncaughtException', { error: error?.message || String(error), stack: error?.stack })
  })
  process.on('unhandledRejection', reason => {
    appendAppEventLog('process:unhandledRejection', { reason: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined })
  })
}
