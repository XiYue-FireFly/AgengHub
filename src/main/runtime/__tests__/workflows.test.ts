import { describe, expect, it } from 'vitest'
import {
  listWorkflows,
  upsertWorkflow,
  deleteWorkflow,
  getWorkflow,
  incrementWorkflowUse,
  searchWorkflows
} from '../workflows'

describe('workflows', () => {
  it('创建工作流', () => {
    const workflow = upsertWorkflow({
      name: 'Test Workflow',
      category: 'custom',
      description: 'A test workflow',
      steps: [
        { id: 'step-1', label: 'Read file', type: 'prompt', prompt: 'Read src/main.ts' }
      ]
    })

    expect(workflow.name).toBe('Test Workflow')
    expect(workflow.steps).toHaveLength(1)
    expect(workflow.steps[0].type).toBe('prompt')
  })

  it('列出工作流', () => {
    const workflows = listWorkflows()
    expect(Array.isArray(workflows)).toBe(true)
  })

  it('按分类筛选工作流', () => {
    const workflows = listWorkflows('custom')
    expect(Array.isArray(workflows)).toBe(true)
  })

  it('获取工作流详情', () => {
    const workflows = listWorkflows()
    if (workflows.length > 0) {
      const workflow = getWorkflow(workflows[0].id)
      expect(workflow).toBeDefined()
      expect(workflow?.id).toBe(workflows[0].id)
    }
  })

  it('删除工作流', () => {
    const workflow = upsertWorkflow({
      name: 'To Delete',
      category: 'custom',
      steps: []
    })

    const deleted = deleteWorkflow(workflow.id)
    expect(deleted).toBe(true)
  })

  it('使用计数递增', () => {
    const workflow = upsertWorkflow({
      name: 'Usage Test',
      category: 'custom',
      steps: []
    })

    incrementWorkflowUse(workflow.id)
    const updated = getWorkflow(workflow.id)
    expect(updated?.useCount).toBe(1)
  })

  it('搜索工作流', () => {
    upsertWorkflow({
      name: 'Searchable Workflow',
      category: 'custom',
      description: 'This is searchable',
      steps: []
    })

    const results = searchWorkflows('searchable')
    expect(results.length).toBeGreaterThan(0)
  })
})
