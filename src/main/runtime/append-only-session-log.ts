/**
 * AppendOnlySessionLog: append-only session log with bounded memory window.
 *
 * Inspired by Kun's append-only-session-log.ts. Provides a fast in-memory
 * window for recent events while the full history is written to the store.
 *
 * R15-aligned: Kun loop/append-only-session-log reference pattern.
 */

export interface SessionEvent {
  id: string
  kind: string
  threadId: string
  turnId: string
  timestamp: number
  data?: unknown
}

export class AppendOnlySessionLog {
  private events: SessionEvent[] = []
  private readonly windowSize: number

  constructor(windowSize = 1_000) {
    this.windowSize = Math.max(1, windowSize)
  }

  /** Append an event to the log. */
  append(event: SessionEvent): void {
    this.events.push(event)
    this.evict()
  }

  /** Get all events in the current window. */
  getEvents(): SessionEvent[] {
    return [...this.events]
  }

  /** Get events since a given timestamp. */
  getEventsSince(timestamp: number): SessionEvent[] {
    return this.events.filter(e => e.timestamp > timestamp)
  }

  /** Get the number of events in the window. */
  size(): number {
    return this.events.length
  }

  /** Clear all events. */
  clear(): void {
    this.events = []
  }

  /** Get the last event. */
  last(): SessionEvent | undefined {
    return this.events[this.events.length - 1]
  }

  /** Evict old events to maintain window size. */
  private evict(): void {
    while (this.events.length > this.windowSize) {
      this.events.shift()
    }
  }
}
