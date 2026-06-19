import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { IC, Icon, Seg } from '../glass/ui'

type UsageTab = 'overview' | 'requests' | 'providers' | 'models' | 'pricing'

const RANGE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '90d', label: '90 天' },
  { value: '30d', label: '30 天' },
  { value: '7d', label: '7 天' }
]

const TAB_OPTIONS = [
  { value: 'overview', label: '概览' },
  { value: 'requests', label: '请求明细' },
  { value: 'providers', label: '供应商' },
  { value: 'models', label: '模型' },
  { value: 'pricing', label: '定价' }
]

const EMPTY_DRAFT = {
  providerId: '',
  modelId: '',
  displayName: '',
  inputUsdPerMillion: '',
  outputUsdPerMillion: '',
  cacheReadUsdPerMillion: '',
  cacheCreationUsdPerMillion: ''
}

export function UsageStatsDashboard() {
  const [range, setRange] = useState<UsageRange>('all')
  const [tab, setTab] = useState<UsageTab>('overview')
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [records, setRecords] = useState<PaginatedUsageRecords | null>(null)
  const [pricing, setPricing] = useState<UsagePricingRule[]>([])
  const [selectedDay, setSelectedDay] = useState<UsageHeatmapDay | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<UsageRequestRecord | null>(null)
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | UsageSource>('all')
  const [status, setStatus] = useState<'all' | UsageRequestRecord['status']>('all')
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    const next = await window.electronAPI.usage.stats(range, tab)
    setStats(next)
    setSelectedDay(current => {
      if (current && next.heatmap.some(day => day.date === current.date)) return next.heatmap.find(day => day.date === current.date) || current
      return next.heatmap.find(day => day.selected) || next.heatmap.find(day => day.turns > 0 || day.tokens > 0) || next.heatmap.at(-1) || null
    })
    setSelectedModelKey(current => {
      if (current && next.models.some(row => usageModelKey(row) === current)) return current
      return next.models[0] ? usageModelKey(next.models[0]) : null
    })
  }, [range, tab])

  const loadRecords = useCallback(async () => {
    const filter: UsageRecordFilter = { range, source, status, query, sortBy: 'createdAt', sortDir: 'desc' }
    const next = await window.electronAPI.usage.records(filter, page, 25)
    setRecords(next)
    setSelectedRecord(current => {
      if (current && next.records.some(record => record.id === current.id)) return current
      return next.records[0] || null
    })
  }, [page, query, range, source, status])

  const loadPricing = useCallback(async () => {
    setPricing(await window.electronAPI.usage.pricingList())
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadStats()
      if (tab === 'requests') await loadRecords()
      if (tab === 'pricing') await loadPricing()
    } catch (err: any) {
      setError(err?.message || '加载使用统计失败')
    } finally {
      setLoading(false)
    }
  }, [loadPricing, loadRecords, loadStats, tab])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 220)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => { setPage(1) }, [query, range, source, status])

  const selectedModel = stats?.models.find(row => usageModelKey(row) === selectedModelKey) || null
  const cards = useMemo(() => stats ? [
    { label: '真实 Token', value: formatToken(stats.actualTokens), hint: stats.hasEstimated ? `另含估算 ${formatToken(stats.estimatedTokens)}` : '仅真实 usage' },
    { label: '估算 Token', value: stats.estimatedTokens > 0 ? `约 ${formatToken(stats.estimatedTokens)}` : '0 tokens', hint: stats.hasEstimated ? '本地 CLI/ACP 粗略估算' : '暂无估算' },
    { label: '输入 / 输出', value: `${compactToken(stats.inputTokens)} / ${compactToken(stats.outputTokens)}`, hint: 'prompt 与 completion' },
    { label: '缓存命中', value: stats.cacheReadTokens > 0 ? compactToken(stats.cacheReadTokens) : '0', hint: stats.cacheRate == null ? '暂无缓存数据' : `${Math.round(stats.cacheRate * 100)}% cache` },
    { label: '成本', value: formatCost(stats.costUsd, stats.hasUnpriced), hint: stats.hasUnpriced ? '部分模型未定价' : '按本地定价表计算' },
    { label: '请求数', value: String(stats.requests), hint: `${stats.activeDays} 个活跃日` }
  ] : [], [stats])

  const upsertPricing = async () => {
    if (!draft.modelId.trim()) return
    await window.electronAPI.usage.pricingUpsert({
      providerId: draft.providerId.trim() || undefined,
      modelId: draft.modelId.trim(),
      displayName: draft.displayName.trim() || undefined,
      inputUsdPerMillion: Number(draft.inputUsdPerMillion || 0),
      outputUsdPerMillion: Number(draft.outputUsdPerMillion || 0),
      cacheReadUsdPerMillion: draft.cacheReadUsdPerMillion === '' ? undefined : Number(draft.cacheReadUsdPerMillion),
      cacheCreationUsdPerMillion: draft.cacheCreationUsdPerMillion === '' ? undefined : Number(draft.cacheCreationUsdPerMillion)
    })
    setDraft(EMPTY_DRAFT)
    await loadPricing()
    await loadStats()
  }

  const editPricing = (rule: UsagePricingRule) => {
    setDraft({
      providerId: rule.providerId || '',
      modelId: rule.modelId,
      displayName: rule.displayName || '',
      inputUsdPerMillion: String(rule.inputUsdPerMillion ?? ''),
      outputUsdPerMillion: String(rule.outputUsdPerMillion ?? ''),
      cacheReadUsdPerMillion: rule.cacheReadUsdPerMillion == null ? '' : String(rule.cacheReadUsdPerMillion),
      cacheCreationUsdPerMillion: rule.cacheCreationUsdPerMillion == null ? '' : String(rule.cacheCreationUsdPerMillion)
    })
  }

  const deletePricing = async (rule: UsagePricingRule) => {
    await window.electronAPI.usage.pricingDelete(rule.id)
    await loadPricing()
    await loadStats()
  }

  return (
    <div className="wb-usage-shell wb-usage-dashboard">
      <div className="wb-usage-top">
        <Seg value={tab} onChange={value => setTab(value as UsageTab)} options={TAB_OPTIONS} />
        <div className="wb-usage-actions">
          <Seg value={range} onChange={value => setRange(value as UsageRange)} options={RANGE_OPTIONS} />
          <button className="ah-btn sm" onClick={refresh} disabled={loading} title="刷新">
            <Icon d={IC.refresh} size={14} />
            刷新
          </button>
        </div>
      </div>

      {loading && <div className="wb-usage-state">加载中...</div>}
      {error && <div className="wb-usage-state error">{error}</div>}

      {!error && stats && (
        <>
          {tab === 'overview' && (
            <>
              <div className="wb-usage-cards">
                {cards.map(card => (
                  <div key={card.label} className="wb-usage-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.hint}</small>
                  </div>
                ))}
              </div>
              <div className="wb-usage-body">
                <div className="wb-usage-chart">
                  <div className="wb-usage-heatmap">
                    {stats.heatmap.map(day => (
                      <button
                        key={day.date}
                        type="button"
                        className={`wb-usage-day level-${day.level}${selectedDay?.date === day.date ? ' selected' : ''}`}
                        title={`${day.date} / ${day.turns} 条 / ${formatUsageTokens(day.tokens, day.hasEstimated)}`}
                        onClick={() => setSelectedDay(day)}
                      />
                    ))}
                  </div>
                </div>
                <UsageDetailCard
                  title={selectedDay?.date || '未选择日期'}
                  rows={[
                    ['请求', String(selectedDay?.turns || 0)],
                    ['总量', formatUsageTokens(selectedDay?.tokens || 0, selectedDay?.hasEstimated)],
                    ['输入', formatToken(selectedDay?.inputTokens || 0)],
                    ['输出', formatToken(selectedDay?.outputTokens || 0)],
                    ['缓存', formatToken(selectedDay?.cacheReadTokens || 0)],
                    ['成本', formatCost(selectedDay?.costUsd ?? null, selectedDay?.hasUnpriced)]
                  ]}
                />
              </div>
            </>
          )}

          {tab === 'requests' && (
            <div className="wb-usage-wide">
              <div className="wb-usage-filter-row">
                <input className="ah-input" placeholder="搜索供应商、模型、Agent 或内容预览" value={query} onChange={event => setQuery(event.target.value)} />
                <select className="ah-select" value={source} onChange={event => setSource(event.target.value as any)}>
                  <option value="all">全部来源</option>
                  <option value="actual">真实 usage</option>
                  <option value="estimated">估算 usage</option>
                  <option value="none">无 token</option>
                </select>
                <select className="ah-select" value={status} onChange={event => setStatus(event.target.value as any)}>
                  <option value="all">全部状态</option>
                  <option value="completed">已完成</option>
                  <option value="failed">失败</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
              <div className="wb-usage-request-layout">
                <div className="wb-usage-table">
                  {(records?.records || []).map(record => (
                    <button key={record.id} className={'wb-usage-row' + (selectedRecord?.id === record.id ? ' selected' : '')} onClick={() => setSelectedRecord(record)}>
                      <span>{formatDateTime(record.createdAt)}</span>
                      <strong>{record.providerId} / {record.modelId}</strong>
                      <span>{record.agentId || '-'}</span>
                      <span>{formatUsageTokens(record.totalTokens, record.hasEstimated)}</span>
                      <span>{formatCost(record.costUsd, record.hasUnpriced)}</span>
                    </button>
                  ))}
                  {records && records.records.length === 0 && <div className="wb-usage-empty">暂无请求明细。</div>}
                </div>
                <UsageDetailCard
                  title={selectedRecord ? `${selectedRecord.providerId} / ${selectedRecord.modelId}` : '未选择请求'}
                  rows={selectedRecord ? [
                    ['时间', formatDateTime(selectedRecord.createdAt)],
                    ['状态', selectedRecord.status],
                    ['来源', selectedRecord.source === 'estimated' ? '估算' : selectedRecord.source === 'none' ? '无 token' : '真实'],
                    ['输入', formatToken(selectedRecord.inputTokens)],
                    ['输出', formatToken(selectedRecord.outputTokens)],
                    ['缓存读取', formatToken(selectedRecord.cacheReadTokens)],
                    ['缓存写入', formatToken(selectedRecord.cacheCreationTokens)],
                    ['延迟', selectedRecord.latencyMs == null ? '-' : `${selectedRecord.latencyMs}ms`],
                    ['成本', formatCost(selectedRecord.costUsd, selectedRecord.hasUnpriced)]
                  ] : []}
                  preview={selectedRecord?.errorMessage || selectedRecord?.responsePreview || selectedRecord?.promptPreview}
                />
              </div>
              {records && records.total > records.pageSize && (
                <div className="wb-usage-pager">
                  <button className="ah-btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
                  <span>{page} / {Math.ceil(records.total / records.pageSize)}</span>
                  <button className="ah-btn sm" disabled={page >= Math.ceil(records.total / records.pageSize)} onClick={() => setPage(page + 1)}>下一页</button>
                </div>
              )}
            </div>
          )}

          {tab === 'providers' && (
            <RankList
              empty="暂无供应商统计。"
              rows={stats.providers.map(row => ({
                key: row.providerId,
                title: row.providerId,
                meta: `${row.requests} requests / ${row.turns} turns`,
                tokens: row.tokens,
                estimated: row.hasEstimated,
                cost: row.costUsd,
                unpriced: row.hasUnpriced,
                detail: `${compactToken(row.inputTokens)} input / ${compactToken(row.outputTokens)} output / ${compactToken(row.cacheReadTokens)} cache`
              }))}
            />
          )}

          {tab === 'models' && (
            <div className="wb-usage-body">
              <RankList
                empty="暂无模型统计。"
                selectedKey={selectedModelKey}
                onSelect={setSelectedModelKey}
                rows={stats.models.map(row => ({
                  key: usageModelKey(row),
                  title: row.modelId,
                  meta: `${row.providerId || '-'} / ${row.agentId || '-'}`,
                  tokens: row.tokens,
                  estimated: row.hasEstimated,
                  cost: row.costUsd,
                  unpriced: row.hasUnpriced,
                  detail: `${row.requests} requests / ${compactToken(row.inputTokens)} input / ${compactToken(row.outputTokens)} output`
                }))}
              />
              <UsageDetailCard
                title={selectedModel?.modelId || '未选择模型'}
                rows={selectedModel ? [
                  ['供应商', selectedModel.providerId || '-'],
                  ['Agent', selectedModel.agentId || '-'],
                  ['请求', String(selectedModel.requests)],
                  ['真实', formatToken(selectedModel.actualTokens)],
                  ['估算', selectedModel.estimatedTokens ? `约 ${formatToken(selectedModel.estimatedTokens)}` : '0 tokens'],
                  ['缓存', formatToken(selectedModel.cacheReadTokens)],
                  ['成本', formatCost(selectedModel.costUsd, selectedModel.hasUnpriced)]
                ] : []}
              />
            </div>
          )}

          {tab === 'pricing' && (
            <div className="wb-usage-wide">
              <div className="wb-pricing-form">
                <input className="ah-input" placeholder="供应商，可空" value={draft.providerId} onChange={event => setDraft({ ...draft, providerId: event.target.value })} />
                <input className="ah-input" placeholder="模型 ID" value={draft.modelId} onChange={event => setDraft({ ...draft, modelId: event.target.value })} />
                <input className="ah-input" placeholder="显示名，可空" value={draft.displayName} onChange={event => setDraft({ ...draft, displayName: event.target.value })} />
                <input className="ah-input" type="number" min="0" step="0.0001" placeholder="输入 $/1M" value={draft.inputUsdPerMillion} onChange={event => setDraft({ ...draft, inputUsdPerMillion: event.target.value })} />
                <input className="ah-input" type="number" min="0" step="0.0001" placeholder="输出 $/1M" value={draft.outputUsdPerMillion} onChange={event => setDraft({ ...draft, outputUsdPerMillion: event.target.value })} />
                <input className="ah-input" type="number" min="0" step="0.0001" placeholder="缓存读 $/1M" value={draft.cacheReadUsdPerMillion} onChange={event => setDraft({ ...draft, cacheReadUsdPerMillion: event.target.value })} />
                <input className="ah-input" type="number" min="0" step="0.0001" placeholder="缓存写 $/1M" value={draft.cacheCreationUsdPerMillion} onChange={event => setDraft({ ...draft, cacheCreationUsdPerMillion: event.target.value })} />
                <button className="ah-btn sm primary" onClick={upsertPricing} disabled={!draft.modelId.trim()}>保存定价</button>
              </div>
              <div className="wb-usage-table">
                {pricing.map(rule => (
                  <div key={rule.id} className="wb-usage-row wb-pricing-row">
                    <strong>{rule.providerId ? `${rule.providerId} / ${rule.modelId}` : rule.modelId}</strong>
                    <span>in ${rule.inputUsdPerMillion}/1M</span>
                    <span>out ${rule.outputUsdPerMillion}/1M</span>
                    <span>cache r ${rule.cacheReadUsdPerMillion ?? 0}/1M</span>
                    <span>cache w ${rule.cacheCreationUsdPerMillion ?? rule.inputUsdPerMillion}/1M</span>
                    <button className="ah-btn sm" onClick={() => editPricing(rule)}>编辑</button>
                    <button className="ah-btn sm danger" onClick={() => deletePricing(rule)}>删除</button>
                  </div>
                ))}
                {pricing.length === 0 && <div className="wb-usage-empty">暂无定价规则。Token 仍会统计，成本显示为未定价。</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function UsageDetailCard({ title, rows, preview }: { title: string; rows: Array<[string, string]>; preview?: string }) {
  return (
    <aside className="wb-usage-detail">
      <strong>{title}</strong>
      {rows.length === 0 && <span>选择一条记录查看详情。</span>}
      <div className="wb-usage-mini-metrics">
        {rows.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      {preview && <p className="wb-usage-preview">{preview}</p>}
    </aside>
  )
}

function RankList({ rows, empty, selectedKey, onSelect }: {
  rows: Array<{ key: string; title: string; meta: string; detail: string; tokens: number; estimated?: boolean; cost: number | null; unpriced?: boolean }>
  empty: string
  selectedKey?: string | null
  onSelect?: (key: string) => void
}) {
  if (!rows.length) return <div className="wb-usage-empty">{empty}</div>
  return (
    <div className="wb-usage-models">
      {rows.map(row => (
        <button key={row.key} type="button" className={'wb-usage-model-row' + (selectedKey === row.key ? ' selected' : '')} onClick={() => onSelect?.(row.key)}>
          <span><strong>{row.title}</strong><small>{row.meta}</small></span>
          <span>{row.detail}</span>
          <strong>{formatUsageTokens(row.tokens, row.estimated)}</strong>
          <small>{formatCost(row.cost, row.unpriced)}</small>
        </button>
      ))}
    </div>
  )
}

function usageModelKey(row: UsageModelRow): string {
  return `${row.providerId || 'provider'}:${row.agentId || 'agent'}:${row.modelId}`
}

function compactToken(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(value)
}

function formatToken(value: number): string {
  return `${compactToken(value)} tokens`
}

function formatUsageTokens(value: number, hasEstimated?: boolean): string {
  return `${hasEstimated ? '约 ' : ''}${formatToken(value)}`
}

function formatCost(value: number | null | undefined, unpriced?: boolean): string {
  if (value == null) return unpriced ? '未定价' : '-'
  const formatted = value === 0 ? '$0' : value < 0.01 ? '<$0.01' : `$${value.toFixed(value < 1 ? 4 : 2)}`
  return unpriced ? `${formatted} + 未定价` : formatted
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString()
}
