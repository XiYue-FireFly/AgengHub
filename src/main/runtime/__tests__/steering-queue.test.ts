import { describe, expect, it } from "vitest"
import { SteeringQueue } from "../steering-queue"

describe("SteeringQueue", () => {
  it("starts empty", () => {
    const queue = new SteeringQueue()
    expect(queue.drain()).toEqual([])
    expect(queue.peek()).toEqual([])
    expect(queue.hasPending()).toBe(false)
    expect(queue.currentTurnId()).toBeNull()
  })

  it("enqueues and drains messages", () => {
    const queue = new SteeringQueue()
    queue.setTurn("turn-1")
    queue.enqueue("turn-1", "first message")
    queue.enqueue("turn-1", "second message")

    expect(queue.hasPending()).toBe(true)
    expect(queue.peek()).toEqual(["first message", "second message"])

    const drained = queue.drain()
    expect(drained).toEqual(["first message", "second message"])
    expect(queue.hasPending()).toBe(false)
    expect(queue.drain()).toEqual([])
  })

  it("clears buffer when turn changes", () => {
    const queue = new SteeringQueue()
    queue.setTurn("turn-1")
    queue.enqueue("turn-1", "message")

    queue.setTurn("turn-2")
    expect(queue.hasPending()).toBe(false)
    expect(queue.currentTurnId()).toBe("turn-2")
  })

  it("clears buffer when enqueueing for different turn", () => {
    const queue = new SteeringQueue()
    queue.setTurn("turn-1")
    queue.enqueue("turn-1", "old message")

    queue.enqueue("turn-2", "new message")
    expect(queue.peek()).toEqual(["new message"])
    expect(queue.currentTurnId()).toBe("turn-2")
  })

  it("ignores empty messages", () => {
    const queue = new SteeringQueue()
    queue.setTurn("turn-1")
    queue.enqueue("turn-1", "")
    queue.enqueue("turn-1", "   ")
    queue.enqueue("turn-1", "valid")

    expect(queue.peek()).toEqual(["valid"])
  })

  it("clear resets everything", () => {
    const queue = new SteeringQueue()
    queue.setTurn("turn-1")
    queue.enqueue("turn-1", "message")
    queue.clear()

    expect(queue.hasPending()).toBe(false)
    expect(queue.currentTurnId()).toBeNull()
  })
})
