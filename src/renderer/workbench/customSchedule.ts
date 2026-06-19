export type CustomScheduleTemplateKind = 'five' | 'parallel' | 'executor'

const CORE_AGENT_PREFERENCES = ['claude', 'codex', 'minimax-code']
const EXECUTOR_PREFERENCES = ['codex', 'minimax-code', 'claude']

function readyAgentIds(agentIds: string[]): string[] {
  return [...new Set(agentIds.map(id => String(id || '').trim()).filter(Boolean))]
}

function pickAgent(available: string[], preferred: string[], avoid?: string): string {
  return preferred.find(id => id !== avoid && available.includes(id)) ||
    available.find(id => id !== avoid) ||
    available[0] ||
    'auto'
}

export function isConcreteScheduleAgent(agentId: string | undefined | null): boolean {
  return !!agentId && agentId !== 'auto' && agentId !== 'all'
}

export function customScheduleHasRunnableSteps(schedule: SchedulePreview): boolean {
  return schedule.steps.some(step => isConcreteScheduleAgent(step.agentId))
}

export function sanitizeCustomSchedule(schedule: SchedulePreview, availableAgentIds: string[]): SchedulePreview {
  const available = readyAgentIds(availableAgentIds)
  const allowed = new Set(available)
  const fallback = available[0] || 'auto'
  return {
    ...schedule,
    steps: schedule.steps.map(step => ({
      ...step,
      agentId: isConcreteScheduleAgent(step.agentId) && allowed.has(step.agentId) ? step.agentId : fallback
    }))
  }
}

export function defaultCustomSchedule(): SchedulePreview {
  return {
    preset: 'custom',
    label: 'Custom schedule',
    labelZh: '自定义调度',
    labelEn: 'Custom schedule',
    description: 'Run with the agent nodes and dependencies you edit.',
    descriptionZh: '按你编辑的 Agent 节点和依赖关系执行。',
    descriptionEn: 'Run with the agent nodes and dependencies you edit.',
    steps: [
      { id: 'custom-1', label: 'Implement / analyze', labelZh: '实现 / 分析', labelEn: 'Implement / analyze', agentId: 'auto', role: 'worker', mode: 'auto' },
      { id: 'custom-2', label: 'Review / synthesize', labelZh: '评审 / 汇总', labelEn: 'Review / synthesize', agentId: 'auto', role: 'reviewer', mode: 'auto', dependsOn: ['custom-1'] }
    ]
  }
}

export function defaultSmartFiveRoleSchedule(availableAgentIds: string[] = []): SchedulePreview {
  const available = readyAgentIds(availableAgentIds)
  const main = pickAgent(available, CORE_AGENT_PREFERENCES)
  const router = pickAgent(available, CORE_AGENT_PREFERENCES, main)
  const reviewer = pickAgent(available, CORE_AGENT_PREFERENCES, router)
  const executor = pickAgent(available, EXECUTOR_PREFERENCES, reviewer)
  const gatekeeper = pickAgent(available, CORE_AGENT_PREFERENCES, executor)
  return {
    preset: 'firefly-custom',
    label: 'Smart five-role',
    labelZh: '智能五角色',
    labelEn: 'Smart five-role',
    description: 'Run one agent after another: router, main, reviewer, executor, then gatekeeper releases one final answer.',
    descriptionZh: '一个 Agent 执行完交给下一个：路由、主 Agent、审查、执行，最后由门禁统一输出。',
    descriptionEn: 'Run one agent after another: router, main, reviewer, executor, then gatekeeper releases one final answer.',
    steps: [
      { id: 'router', label: 'Router / state', labelZh: '路由 / 状态', labelEn: 'Router / state', agentId: router, role: 'router', mode: 'auto' },
      { id: 'main', label: 'Main / chat', labelZh: '主 Agent / 对话', labelEn: 'Main / chat', agentId: main, role: 'lead', mode: 'auto', dependsOn: ['router'] },
      { id: 'reviewer', label: 'Reviewer / safety', labelZh: '审查 / 安全', labelEn: 'Reviewer / safety', agentId: reviewer, role: 'reviewer', mode: 'auto', dependsOn: ['main'] },
      { id: 'executor', label: 'Executor / actions', labelZh: '执行 / 操作', labelEn: 'Executor / actions', agentId: executor, role: 'executor', mode: 'auto', dependsOn: ['reviewer'] },
      { id: 'gatekeeper', label: 'Gatekeeper / final', labelZh: '门禁 / 最终', labelEn: 'Gatekeeper / final', agentId: gatekeeper, role: 'gatekeeper', mode: 'auto', dependsOn: ['executor'] }
    ]
  }
}

export function isStoredSchedule(value: unknown, preset?: DispatchPreset): value is SchedulePreview {
  if (!value || typeof value !== 'object') return false
  const item = value as SchedulePreview
  if (preset && item.preset !== preset) return false
  return Array.isArray(item.steps) && item.steps.every(step => !!step && typeof step.id === 'string' && typeof step.agentId === 'string')
}

export function buildCustomScheduleTemplate(
  kind: CustomScheduleTemplateKind,
  base: SchedulePreview,
  availableAgentIds: string[]
): SchedulePreview | null {
  const available = readyAgentIds(availableAgentIds)
  if (available.length === 0) return null

  if (kind === 'five') {
    const main = pickAgent(available, CORE_AGENT_PREFERENCES)
    const router = pickAgent(available, CORE_AGENT_PREFERENCES, main)
    const reviewer = pickAgent(available, CORE_AGENT_PREFERENCES, router)
    const executor = pickAgent(available, EXECUTOR_PREFERENCES, reviewer)
    const gatekeeper = pickAgent(available, CORE_AGENT_PREFERENCES, executor)
    return {
      ...base,
      label: 'Five-role template',
      steps: [
        { id: 'router', label: 'Router / state', agentId: router, role: 'router', mode: 'auto' },
        { id: 'main', label: 'Main / chat', agentId: main, role: 'lead', mode: 'auto', dependsOn: ['router'] },
        { id: 'reviewer', label: 'Reviewer / safety', agentId: reviewer, role: 'reviewer', mode: 'auto', dependsOn: ['main'] },
        { id: 'executor', label: 'Executor / actions', agentId: executor, role: 'executor', mode: 'auto', dependsOn: ['reviewer'] },
        { id: 'gatekeeper', label: 'Gatekeeper / final', agentId: gatekeeper, role: 'gatekeeper', mode: 'auto', dependsOn: ['executor'] }
      ]
    }
  }

  if (kind === 'parallel') {
    const first = pickAgent(available, EXECUTOR_PREFERENCES)
    const second = pickAgent(available, CORE_AGENT_PREFERENCES, first)
    const gatekeeper = pickAgent(available, CORE_AGENT_PREFERENCES, second)
    return {
      ...base,
      label: 'Parallel review template',
      steps: [
        { id: 'review-a', label: 'Review A', agentId: first, role: 'reviewer', mode: 'auto' },
        { id: 'review-b', label: 'Review B', agentId: second, role: 'reviewer', mode: 'auto' },
        { id: 'gatekeeper', label: 'Gatekeeper', agentId: gatekeeper, role: 'gatekeeper', mode: 'auto', dependsOn: ['review-a', 'review-b'] }
      ]
    }
  }

  const reviewer = pickAgent(available, CORE_AGENT_PREFERENCES)
  const executor = pickAgent(available, EXECUTOR_PREFERENCES, reviewer)
  const gatekeeper = pickAgent(available, CORE_AGENT_PREFERENCES, executor)
  return {
    ...base,
    label: 'Executor gate template',
    steps: [
      { id: 'reviewer', label: 'Risk Review', agentId: reviewer, role: 'reviewer', mode: 'auto' },
      { id: 'executor', label: 'Executor', agentId: executor, role: 'executor', mode: 'auto', dependsOn: ['reviewer'] },
      { id: 'gatekeeper', label: 'Gatekeeper', agentId: gatekeeper, role: 'gatekeeper', mode: 'auto', dependsOn: ['executor'] }
    ]
  }
}
