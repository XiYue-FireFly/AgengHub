/**
 * SteeringQueue: mid-turn steering queue for user input during agent execution.
 *
 * Inspired by Kun's steering-queue.ts. The renderer posts steering text while a
 * turn is running; the queue collects those messages and injects them as user
 * inputs at the next safe loop boundary. The queue is cleared on turn completion
 * or interruption.
 *
 * R15-aligned: Kun loop/steering-queue reference pattern.
 */

export class SteeringQueue {
  private readonly buffer: string[] = []
  private turnId: string | null = null

  /** Set the active turn. Clears buffer if turn changes. */
  setTurn(turnId: string | null): void {
    if (this.turnId !== turnId) {
      this.buffer.length = 0
    }
    this.turnId = turnId
  }

  /** Enqueue a steering message for the current turn. */
  enqueue(turnId: string, text: string): void {
    if (this.turnId !== turnId) {
      this.buffer.length = 0
      this.turnId = turnId
    }
    const trimmed = text.trim()
    if (!trimmed) return
    this.buffer.push(trimmed)
  }

  /**
   * Drain queued steering messages and return them. The loop calls
   * this at safe boundaries (after a model response, before the next
   * model request). Returns an empty array when nothing is pending.
   */
  drain(): string[] {
    if (this.buffer.length === 0) return []
    const out = [...this.buffer]
    this.buffer.length = 0
    return out
  }

  /** Peek at the queued text without removing it. */
  peek(): string[] {
    return [...this.buffer]
  }

  /** Clear the queue and reset turn. */
  clear(): void {
    this.buffer.length = 0
    this.turnId = null
  }

  /** Get the current turn ID. */
  currentTurnId(): string | null {
    return this.turnId
  }

  /** Check if there are pending steering messages. */
  hasPending(): boolean {
    return this.buffer.length > 0
  }
}
