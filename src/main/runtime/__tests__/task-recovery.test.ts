import { describe, expect, it, beforeEach, vi } from 'vitest'

const memory: Record<string, any> = {}
const mockStore = {
  get: (key: string) => memory[key],
  set: (key: string, value: any) => { memory[key] = value }
}

// Mock the store module
vi.mock('../../store', () => ({ store: mockStore }))

describe('task-recovery', () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    vi.resetModules()
  })

  it('registers and retrieves tasks', async () => {
    const { registerTask, getTask } = await import('../task-recovery')
    registerTask({ id: 't1', title: 'Test task', status: 'running', recoverable: false })
    const task = getTask('t1')
    expect(task).toBeDefined()
    expect(task!.title).toBe('Test task')
    expect(task!.status).toBe('running')
  })

  it('updates task status', async () => {
    const { registerTask, updateTaskStatus, getTask } = await import('../task-recovery')
    registerTask({ id: 't2', title: 'Task 2', status: 'running', recoverable: false })
    updateTaskStatus('t2', 'completed')
    expect(getTask('t2')!.status).toBe('completed')
    expect(getTask('t2')!.recoverable).toBe(false)
  })

  it('marks failed tasks as recoverable', async () => {
    const { registerTask, updateTaskStatus, getTask } = await import('../task-recovery')
    registerTask({ id: 't3', title: 'Task 3', status: 'running', recoverable: false })
    updateTaskStatus('t3', 'failed', 'timeout')
    const task = getTask('t3')!
    expect(task.status).toBe('failed')
    expect(task.reason).toBe('timeout')
    expect(task.recoverable).toBe(true)
  })

  it('recovers interrupted tasks on startup', async () => {
    const { registerTask, recoverInterruptedTasks, getTask } = await import('../task-recovery')
    registerTask({ id: 't4', title: 'Running task', status: 'running', recoverable: false })
    registerTask({ id: 't5', title: 'Completed task', status: 'completed', recoverable: false })

    const interrupted = recoverInterruptedTasks()
    expect(interrupted).toHaveLength(1)
    expect(interrupted[0].id).toBe('t4')
    expect(getTask('t4')!.status).toBe('interrupted')
    expect(getTask('t4')!.recoverable).toBe(true)
    expect(getTask('t5')!.status).toBe('completed') // unchanged
  })

  it('returns only recoverable tasks', async () => {
    const { registerTask, updateTaskStatus, getRecoverableTasks } = await import('../task-recovery')
    registerTask({ id: 't6', title: 'Will fail', status: 'running', recoverable: false })
    registerTask({ id: 't7', title: 'Will succeed', status: 'running', recoverable: false })
    updateTaskStatus('t6', 'failed', 'error')
    updateTaskStatus('t7', 'completed')
    const recoverable = getRecoverableTasks()
    expect(recoverable).toHaveLength(1)
    expect(recoverable[0].id).toBe('t6')
  })
})
