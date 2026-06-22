/**
 * InflightTracker: tracks running model and tool work with stable ids.
 *
 * Inspired by Kun's inflight-tracker.ts. Guarantees cleanup on success,
 * error, and abort. The tracker is the authoritative source for the
 * event stream: every `begin` corresponds to a start/end pair.
 *
 * R15-aligned: Kun loop/inflight-tracker reference pattern.
 */

export type InflightKind = 'model' | 'tool' | 'agent'

export interface InflightRecord {
  id: string
  kind: InflightKind
  threadId: string
  turnId?: string
  callId?: string
  startedAt: number
}

export class InflightTracker {
  private readonly entries = new Map<string, InflightRecord>()

  /** Register an inflight work item. */
  begin(record: Omit<InflightRecord, 'startedAt'> & { startedAt?: number }): InflightRecord {
    const full: InflightRecord = { ...record, startedAt: record.startedAt ?? Date.now() }
    this.entries.set(full.id, full)
    return full
  }

  /** Remove an inflight work item. */
  end(id: string): InflightRecord | undefined {
    const record = this.entries.get(id)
    if (!record) return undefined
    this.entries.delete(id)
    return record
  }

  /**
   * Register an inflight id, run work, and guarantee cleanup.
   * Returns whatever the work resolves to.
   */
  async run<T>(
    record: Omit<InflightRecord, 'startedAt'>,
    work: () => Promise<T>
  ): Promise<T> {
    this.begin(record)
    try {
      return await work()
    } finally {
      this.end(record.id)
    }
  }

  /** Get a specific inflight record. */
  get(id: string): InflightRecord | undefined {
    return this.entries.get(id)
  }

  /** Check if an id is currently inflight. */
  has(id: string): boolean {
    return this.entries.has(id)
  }

  /** List all inflight records. */
  list(): InflightRecord[] {
    return Array.from(this.entries.values())
  }

  /** Get count of inflight items. */
  size(): number {
    return this.entries.size
  }

  /** Clear all inflight entries. */
  clear(): void {
    this.entries.clear()
  }
}
