import { beforeEach, describe, expect, it, vi } from "vitest"

const memory: Record<string, any> = {}

vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  }
}))

describe("thread todos", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it("keeps an existing status when an agent plan upserts the same todo again", async () => {
    const { upsertThreadTodo, listThreadTodos } = await import("../todos")

    const first = upsertThreadTodo({ threadId: "thread-1", id: "orchestrate-turn-1-a", content: "Inspect route" })
    upsertThreadTodo({ threadId: "thread-1", id: first.id, content: first.content, status: "completed" })
    upsertThreadTodo({ threadId: "thread-1", id: first.id, content: first.content })

    expect(listThreadTodos("thread-1")).toHaveLength(1)
    expect(listThreadTodos("thread-1")[0]).toMatchObject({
      id: first.id,
      content: "Inspect route",
      status: "completed"
    })
  })
})
