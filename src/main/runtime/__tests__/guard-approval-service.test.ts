import { describe, expect, it } from 'vitest'
import { evaluateGuardVerdict, executorVerdictNeedsApproval } from '../guard-approval-service'

describe('guard-approval-service', () => {
  it('评估安全的审查文本', () => {
    const verdict = evaluateGuardVerdict('This is a safe change', 'reviewer')
    expect(verdict).toBeDefined()
    expect(verdict.level).toBeDefined()
    expect(verdict.status).toBeDefined()
  })

  it('检测高风险操作', () => {
    const verdict = evaluateGuardVerdict('This contains rm -rf command', 'executor')
    expect(verdict).toBeDefined()
    expect(['high', 'critical']).toContain(verdict.level)
  })

  it('executor 判定需要审批', () => {
    const verdict = { level: 'high' as const, status: 'block' as const, reasons: [] }
    expect(executorVerdictNeedsApproval(verdict, 'executor')).toBe(true)
  })

  it('reviewer 判定不需要审批', () => {
    const verdict = { level: 'low' as const, status: 'pass' as const, reasons: [] }
    expect(executorVerdictNeedsApproval(verdict, 'reviewer')).toBe(false)
  })
})
