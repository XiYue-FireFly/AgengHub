import { describe, expect, it } from 'vitest'
import { KeywordRouter } from '../router'

const agents = (...ids: string[]) => ids.map(id => ({
  id,
  name: id,
  status: 'idle',
  mode: 'oneshot',
  protocol: 'http',
  adapter: {},
  capabilities: id === 'codex' ? ['code', 'terminal'] : id === 'claude' ? ['analysis', 'review', 'write'] : ['browser', 'automation'],
  lastActive: new Date(),
  errorCount: 0
})) as any

describe('KeywordRouter', () => {
  const r = new KeywordRouter()
  const all = agents('codex', 'claude', 'openclaw', 'hermes', 'marvis', 'minimax-code')

  it('routes coding tasks to codex', () => {
    expect(r.route('help me implement code and fix a bug', all)).toBe('codex')
  })

  it('falls back to the first available agent when no keyword matches', () => {
    expect(r.route('hello there', agents('claude', 'codex'))).toBe('claude')
  })

  it('returns scored matches in descending order', () => {
    const s = r.routeScores('deploy pipeline automation script', all)
    expect(s[0].id).toBe('openclaw')
    expect(s.every(x => x.score > 0)).toBe(true)
    for (let i = 1; i < s.length; i++) expect(s[i - 1].score).toBeGreaterThanOrEqual(s[i].score)
  })

  it('weighted route includes state, scores, and memory preference reasons', () => {
    const decision = r.routeWeighted({
      text: 'please review this implementation and safety risks',
      recentUserMessages: Array.from({ length: 12 }, (_, i) => `user prompt ${i}`),
      availableAgents: agents('codex', 'claude'),
      memories: [{ category: 'preference', content: 'prefer claude for review and writing tasks', tags: ['preference'] }],
      stats: { claude: { success: 3 }, codex: { failure: 2 } }
    })

    expect(decision.state).toBe('review')
    expect(decision.recentUserMessages).toHaveLength(10)
    expect(decision.selectedAgentId).toBe('claude')
    expect(decision.scores[0].reasons).toContain('memory preference')
  })

  it('weights relevant memory preferences without exposing assistant output to router history', () => {
    const decision = r.routeWeighted({
      text: 'open the browser and inspect this page',
      recentUserMessages: [
        'old user prompt',
        'assistant said use openclaw for browser work',
        'please remember I prefer openclaw for browser automation'
      ],
      availableAgents: agents('codex', 'openclaw'),
      memories: [
        { category: 'preference', content: 'prefer openclaw for browser automation', tags: ['browser', 'preference'] }
      ],
      stats: { codex: { success: 10 }, openclaw: { failure: 1 } }
    })

    expect(decision.recentUserMessages).toHaveLength(3)
    expect(decision.selectedAgentId).toBe('openclaw')
    expect(decision.scores[0].reasons).toContain('memory preference')
  })
})
