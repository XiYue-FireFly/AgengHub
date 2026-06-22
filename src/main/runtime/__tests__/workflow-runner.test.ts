import { describe, expect, it } from 'vitest'
import { resolveStepOrder, executeWorkflow } from '../workflow-runner'

describe('workflow-runner', () => {
  describe('resolveStepOrder', () => {
    it('returns steps in dependency order', () => {
      const steps = [
        { id: 'a', dependsOn: [] },
        { id: 'b', dependsOn: ['a'] },
        { id: 'c', dependsOn: ['b'] }
      ]
      const order = resolveStepOrder(steps)
      expect(order).toEqual(['a', 'b', 'c'])
    })

    it('handles parallel steps with no dependencies', () => {
      const steps = [
        { id: 'a', dependsOn: [] },
        { id: 'b', dependsOn: [] },
        { id: 'c', dependsOn: ['a', 'b'] }
      ]
      const order = resolveStepOrder(steps)
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
    })

    it('throws on cycle', () => {
      const steps = [
        { id: 'a', dependsOn: ['b'] },
        { id: 'b', dependsOn: ['a'] }
      ]
      expect(() => resolveStepOrder(steps)).toThrow('Cycle detected')
    })

    it('throws on unknown dependency', () => {
      const steps = [
        { id: 'a', dependsOn: ['nonexistent'] }
      ]
      expect(() => resolveStepOrder(steps)).toThrow('Unknown dependency')
    })
  })

  describe('executeWorkflow', () => {
    it('executes steps in order', async () => {
      const order: string[] = []
      const steps = [
        { id: 'a', type: 'prompt', label: 'Step A' },
        { id: 'b', type: 'prompt', label: 'Step B', dependsOn: ['a'] }
      ]
      const result = await executeWorkflow('wf-1', steps, async (step) => {
        order.push(step.id)
        return { output: `done ${step.id}` }
      })
      expect(order).toEqual(['a', 'b'])
      expect(result.status).toBe('succeeded')
      expect(result.steps).toHaveLength(2)
    })

    it('stops on failure', async () => {
      const steps = [
        { id: 'a', type: 'prompt', label: 'Step A' },
        { id: 'b', type: 'prompt', label: 'Step B', dependsOn: ['a'] },
        { id: 'c', type: 'prompt', label: 'Step C', dependsOn: ['b'] }
      ]
      const result = await executeWorkflow('wf-2', steps, async (step) => {
        if (step.id === 'b') return { output: '', error: 'step b failed' }
        return { output: 'ok' }
      })
      expect(result.status).toBe('failed')
      expect(result.steps.find(s => s.stepId === 'a')!.status).toBe('succeeded')
      expect(result.steps.find(s => s.stepId === 'b')!.status).toBe('failed')
      expect(result.steps.find(s => s.stepId === 'c')!.status).toBe('skipped')
    })

    it('skips steps with failed dependencies', async () => {
      const steps = [
        { id: 'a', type: 'prompt', label: 'Step A' },
        { id: 'b', type: 'prompt', label: 'Step B' },
        { id: 'c', type: 'prompt', label: 'Step C', dependsOn: ['a', 'b'] }
      ]
      const result = await executeWorkflow('wf-3', steps, async (step) => {
        if (step.id === 'a') return { output: '', error: 'fail' }
        return { output: 'ok' }
      })
      expect(result.steps.find(s => s.stepId === 'c')!.status).toBe('skipped')
    })

    it('fires lifecycle callbacks', async () => {
      const starts: string[] = []
      const ends: string[] = []
      const steps = [
        { id: 'a', type: 'prompt', label: 'A' },
        { id: 'b', type: 'prompt', label: 'B' }
      ]
      await executeWorkflow('wf-4', steps, async () => ({ output: 'ok' }), {
        onStepStart: (id) => starts.push(id),
        onStepEnd: (id) => ends.push(id)
      })
      expect(starts).toEqual(['a', 'b'])
      expect(ends).toEqual(['a', 'b'])
    })
  })
})
