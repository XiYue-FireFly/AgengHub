/**
 * ExecutionReport: 执行报告汇总面板
 * 参照 Codex 终端输出形式：成功/失败统计 + 耗时 + 修改文件
 * Phase 2.4: 全面使用 CSS 变量
 */

import React from 'react'

interface ExecutionStats {
  totalTools: number
  successfulTools: number
  failedTools: number
  totalDuration: number
  filesModified: string[]
  testsRun?: { passed: number; failed: number }
}

interface ExecutionReportProps {
  stats: ExecutionStats
  className?: string
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`
}

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12,
      background: 'var(--bg-input, rgba(255,255,255,0.02))', borderRadius: 8,
      border: '1px solid var(--glass-border-default, rgba(255,255,255,0.06))'
    }}>
      <span style={{ color, fontSize: 18, marginBottom: 4 }}>{icon}</span>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export function ExecutionReport({ stats, className = '' }: ExecutionReportProps) {
  const successRate = stats.totalTools > 0
    ? (stats.successfulTools / stats.totalTools * 100).toFixed(1)
    : '0.0'

  const isSuccess = stats.failedTools === 0
  const accentColor = isSuccess ? 'var(--color-success)' : 'var(--color-error)'

  return (
    <div className={className} style={{
      margin: '16px 0',
      padding: 20,
      background: isSuccess ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
      border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 12,
      backdropFilter: 'blur(var(--glass-blur, 24px))'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ color: accentColor, fontSize: 20 }}>{isSuccess ? '✓' : '✗'}</span>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>执行报告</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 12px', borderRadius: 20, fontWeight: 600, background: isSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: accentColor }}>
          {isSuccess ? '成功' : '失败'}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon="✓" value={stats.successfulTools} label="成功" color="var(--color-success)" />
        <StatCard icon="✗" value={stats.failedTools} label="失败" color="var(--color-error)" />
        <StatCard icon="⏱" value={formatDuration(stats.totalDuration)} label="总耗时" color="var(--color-info)" />
        <StatCard icon="↑" value={`${successRate}%`} label="成功率" color="var(--color-success)" />
      </div>

      {/* Files Modified */}
      {stats.filesModified.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border-default, rgba(255,255,255,0.06))' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)', fontSize: 13, marginBottom: 12 }}>
            📁 修改文件 ({stats.filesModified.length}):
          </strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {stats.filesModified.map((file, index) => (
              <li key={index} style={{ padding: '4px 0', fontSize: 13 }}>
                <code style={{ background: 'var(--bg-code-block, rgba(0,0,0,0.22))', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: 'var(--tx-2)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {file}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Test Results */}
      {stats.testsRun && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border-default, rgba(255,255,255,0.06))' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)', fontSize: 13, marginBottom: 12 }}>
            📋 测试结果:
          </strong>
          <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {stats.testsRun.passed > 0 && (
              <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ {stats.testsRun.passed} passed
              </span>
            )}
            {stats.testsRun.failed > 0 && (
              <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                ✗ {stats.testsRun.failed} failed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export type { ExecutionStats, ExecutionReportProps }
