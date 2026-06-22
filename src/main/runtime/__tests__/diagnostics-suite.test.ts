import { describe, expect, it } from 'vitest'
import { runDiagnosticSuite } from '../diagnostics-suite'

describe('diagnostics-suite', () => {
  it('reports healthy when all checks pass', async () => {
    const report = await runDiagnosticSuite({
      appVersion: '1.0.0',
      hasProviders: true,
      hasAgents: true,
      hasMcpServers: true,
      hasMemoryEntries: true,
      hasWorkspace: true,
      storeSize: 1000,
      uptimeSeconds: 3600
    })
    expect(report.overall).toBe('healthy')
    expect(report.summary.fail).toBe(0)
    expect(report.checks.length).toBeGreaterThanOrEqual(7)
  })

  it('reports degraded when warns present', async () => {
    const report = await runDiagnosticSuite({
      appVersion: '1.0.0',
      hasProviders: false,
      hasAgents: true,
      hasMcpServers: false,
      hasMemoryEntries: false,
      hasWorkspace: false
    })
    expect(report.overall).toBe('degraded')
    expect(report.summary.warn).toBeGreaterThan(0)
  })

  it('checks have required fields', async () => {
    const report = await runDiagnosticSuite({
      appVersion: '1.0.0',
      hasProviders: true,
      hasAgents: false,
      hasMcpServers: false,
      hasMemoryEntries: false,
      hasWorkspace: false
    })
    for (const check of report.checks) {
      expect(check.id).toBeDefined()
      expect(check.name).toBeDefined()
      expect(check.category).toBeDefined()
      expect(check.level).toBeDefined()
      expect(check.message).toBeDefined()
      expect(typeof check.autoFixable).toBe('boolean')
    }
  })
})
