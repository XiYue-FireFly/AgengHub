import type { DispatchPreset, SchedulePreview } from "./types"

export const LOCAL_CORE_AGENTS = ["codex", "claude", "minimax-code"] as const

export function fireflyFiveRoleTemplate(agentIds: string[] = []): SchedulePreview {
  const main = preferredAgent(agentIds, ["claude", "codex", "minimax-code"])
  const router = preferredAgent(agentIds, ["claude", "codex", "minimax-code"], main)
  const reviewer = preferredAgent(agentIds, ["claude", "codex", "minimax-code"], router)
  const executor = preferredAgent(agentIds, ["codex", "minimax-code", "claude"], reviewer)
  const gatekeeper = preferredAgent(agentIds, ["claude", "codex", "minimax-code"], executor)
  return {
    preset: "firefly-custom",
    label: "Smart five-role",
    labelZh: "智能五角色",
    labelEn: "Smart five-role",
    description: "Run a serial handoff: router decides state, main drafts, reviewer checks risk, executor handles approved actions, gatekeeper releases one final answer.",
    descriptionZh: "串行交接：Router 判断状态，主 Agent 起草，Reviewer 审查风险，Executor 处理获批动作，Gatekeeper 统一释放最终回答。",
    descriptionEn: "Run a serial handoff: router decides state, main drafts, reviewer checks risk, executor handles approved actions, gatekeeper releases one final answer.",
    steps: [
      { id: "router", label: "Router / state", labelZh: "路由 / 状态", labelEn: "Router / state", agentId: router, role: "router", mode: "auto" },
      { id: "main", label: "Main / chat", labelZh: "主 Agent / 对话", labelEn: "Main / chat", agentId: main, role: "lead", mode: "auto", dependsOn: ["router"] },
      { id: "reviewer", label: "Reviewer / safety", labelZh: "审查 / 安全", labelEn: "Reviewer / safety", agentId: reviewer, role: "reviewer", mode: "auto", dependsOn: ["main"] },
      { id: "executor", label: "Executor / actions", labelZh: "执行 / 操作", labelEn: "Executor / actions", agentId: executor, role: "executor", mode: "auto", dependsOn: ["reviewer"] },
      { id: "gatekeeper", label: "Gatekeeper / final", labelZh: "门禁 / 最终", labelEn: "Gatekeeper / final", agentId: gatekeeper, role: "gatekeeper", mode: "auto", dependsOn: ["executor"] }
    ]
  }
}

export function parallelReviewTemplate(agentIds: string[] = []): SchedulePreview {
  const first = preferredAgent(agentIds, ["codex", "claude", "minimax-code"])
  const second = preferredAgent(agentIds, ["claude", "codex", "minimax-code"], first)
  const gatekeeper = preferredAgent(agentIds, ["claude", "codex", "minimax-code"], second)
  return {
    preset: "custom",
    label: "Parallel review template",
    labelZh: "并行审查模板",
    labelEn: "Parallel review template",
    description: "Two reviewers inspect in parallel, then a gatekeeper checks the final rule fit.",
    descriptionZh: "两个审查节点并行检查，随后由门禁节点检查最终规则匹配。",
    descriptionEn: "Two reviewers inspect in parallel, then a gatekeeper checks the final rule fit.",
    steps: [
      { id: "review-a", label: "Review A", labelZh: "审查 A", labelEn: "Review A", agentId: first, role: "reviewer", mode: "auto" },
      { id: "review-b", label: "Review B", labelZh: "审查 B", labelEn: "Review B", agentId: second, role: "reviewer", mode: "auto" },
      { id: "gatekeeper", label: "Gatekeeper", labelZh: "门禁", labelEn: "Gatekeeper", agentId: gatekeeper, role: "gatekeeper", mode: "auto", dependsOn: ["review-a", "review-b"] }
    ]
  }
}

export function executorGateTemplate(agentIds: string[] = []): SchedulePreview {
  const reviewer = preferredAgent(agentIds, ["claude", "codex", "minimax-code"])
  const executor = preferredAgent(agentIds, ["codex", "minimax-code", "claude"], reviewer)
  const gatekeeper = preferredAgent(agentIds, ["claude", "codex", "minimax-code"], executor)
  return {
    preset: "custom",
    label: "Executor gate template",
    labelZh: "执行门禁模板",
    labelEn: "Executor gate template",
    description: "Review risk first, execute approved actions, then gate the answer.",
    descriptionZh: "先审查风险，再执行获批动作，最后检查输出。",
    descriptionEn: "Review risk first, execute approved actions, then gate the answer.",
    steps: [
      { id: "reviewer", label: "Risk Review", labelZh: "风险审查", labelEn: "Risk Review", agentId: reviewer, role: "reviewer", mode: "auto" },
      { id: "executor", label: "Executor", labelZh: "执行", labelEn: "Executor", agentId: executor, role: "executor", mode: "auto", dependsOn: ["reviewer"] },
      { id: "gatekeeper", label: "Gatekeeper", labelZh: "门禁", labelEn: "Gatekeeper", agentId: gatekeeper, role: "gatekeeper", mode: "auto", dependsOn: ["executor"] }
    ]
  }
}

export function listSchedules(): SchedulePreview[] {
  return [
    {
      preset: "auto",
      label: "Auto route",
      labelZh: "自动路由",
      labelEn: "Auto route",
      description: "Let AgentHub choose the best available agent for this turn.",
      descriptionZh: "让 AgentHub 为本轮选择最合适的可用 Agent。",
      descriptionEn: "Let AgentHub choose the best available agent for this turn.",
      steps: [
        { id: "auto", label: "Route by task", labelZh: "按任务路由", labelEn: "Route by task", agentId: "auto", role: "target", mode: "auto" }
      ]
    },
    {
      preset: "broadcast",
      label: "Broadcast",
      labelZh: "广播",
      labelEn: "Broadcast",
      description: "Ask every configured agent in parallel.",
      descriptionZh: "并行询问每个已配置的 Agent。",
      descriptionEn: "Ask every configured agent in parallel.",
      steps: [
        { id: "broadcast", label: "Parallel dispatch", labelZh: "并行派发", labelEn: "Parallel dispatch", agentId: "all", role: "worker", mode: "broadcast" }
      ]
    },
    {
      preset: "chain",
      label: "Chain handoff",
      labelZh: "链式交接",
      labelEn: "Chain handoff",
      description: "Pass upstream output into the next local coding agent.",
      descriptionZh: "把上游输出交给下一个本地编码 Agent。",
      descriptionEn: "Pass upstream output into the next local coding agent.",
      steps: [
        { id: "codex", label: "First pass", labelZh: "第一轮处理", labelEn: "First pass", agentId: "codex", role: "worker", mode: "auto" },
        { id: "claude", label: "Second review", labelZh: "第二轮审查", labelEn: "Second review", agentId: "claude", role: "reviewer", mode: "auto", dependsOn: ["codex"] }
      ]
    },
    {
      preset: "orchestrate",
      label: "Orchestrate",
      labelZh: "编排",
      labelEn: "Orchestrate",
      description: "Use the AgentHub planning, verification, and synthesis path.",
      descriptionZh: "使用 AgentHub 的规划、执行、验证和汇总路径。",
      descriptionEn: "Use the AgentHub planning, verification, and synthesis path.",
      steps: [
        { id: "orchestrate", label: "Plan, execute, verify, synthesize", labelZh: "规划、执行、验证、汇总", labelEn: "Plan, execute, verify, synthesize", agentId: "lead", role: "lead", mode: "orchestrate" }
      ]
    },
    {
      preset: "lead-workers",
      label: "Lead + workers",
      labelZh: "主控 + 工作者",
      labelEn: "Lead + workers",
      description: "Lead plans, worker agents execute, then the result is synthesized.",
      descriptionZh: "主控先规划，工作 Agent 执行，最后汇总结果。",
      descriptionEn: "Lead plans, worker agents execute, then the result is synthesized.",
      steps: [
        { id: "lead", label: "Plan task", labelZh: "规划任务", labelEn: "Plan task", agentId: "claude", role: "lead", mode: "auto" },
        { id: "codex-worker", label: "Implement / check", labelZh: "实现 / 检查", labelEn: "Implement / check", agentId: "codex", role: "worker", mode: "auto", dependsOn: ["lead"] },
        { id: "opencode-worker", label: "Second local view", labelZh: "第二视角", labelEn: "Second local view", agentId: "minimax-code", role: "worker", mode: "auto", dependsOn: ["lead"] },
        { id: "synth", label: "Synthesize result", labelZh: "汇总结果", labelEn: "Synthesize result", agentId: "claude", role: "synthesizer", mode: "auto", dependsOn: ["codex-worker", "opencode-worker"] }
      ]
    },
    {
      preset: "parallel-review",
      label: "Parallel review",
      labelZh: "并行评审",
      labelEn: "Parallel review",
      description: "Run multiple agents together, then compare outputs.",
      descriptionZh: "并行运行多个 Agent，再比较输出差异。",
      descriptionEn: "Run multiple agents together, then compare outputs.",
      steps: [
        { id: "codex-review", label: "Codex review", labelZh: "Codex 评审", labelEn: "Codex review", agentId: "codex", role: "reviewer", mode: "auto" },
        { id: "claude-review", label: "Claude review", labelZh: "Claude 评审", labelEn: "Claude review", agentId: "claude", role: "reviewer", mode: "auto" },
        { id: "opencode-review", label: "OpenCode review", labelZh: "OpenCode 评审", labelEn: "OpenCode review", agentId: "minimax-code", role: "reviewer", mode: "auto" },
        { id: "review-synth", label: "Compare outputs", labelZh: "比较输出", labelEn: "Compare outputs", agentId: "claude", role: "synthesizer", mode: "auto", dependsOn: ["codex-review", "claude-review", "opencode-review"] }
      ]
    },
    fireflyFiveRoleTemplate(),
    {
      preset: "custom",
      label: "Custom schedule",
      labelZh: "自定义调度",
      labelEn: "Custom schedule",
      description: "Run the agent nodes and dependency graph edited in the run workspace.",
      descriptionZh: "按你在运行面板编辑的 Agent 节点和依赖关系执行。",
      descriptionEn: "Run the agent nodes and dependency graph edited in the run workspace.",
      steps: [
        { id: "custom-1", label: "Custom step", labelZh: "自定义步骤", labelEn: "Custom step", agentId: "auto", role: "worker", mode: "auto" }
      ]
    }
  ]
}

export function previewSchedule(preset: DispatchPreset): SchedulePreview {
  return listSchedules().find(s => s.preset === preset) ?? listSchedules()[0]
}

export function toDispatcherMode(preset: DispatchPreset): "auto" | "broadcast" | "chain" | "orchestrate" {
  if (preset === "parallel-review") return "broadcast"
  if (preset === "lead-workers") return "orchestrate"
  if (preset === "firefly-custom") return "chain"
  if (preset === "custom") return "chain"
  return preset
}

function preferredAgent(agentIds: string[], preferred: string[], avoid?: string): string {
  const available = [...new Set(agentIds.map(id => String(id || "").trim()).filter(Boolean))]
  return preferred.find(id => id !== avoid && available.includes(id)) ||
    available.find(id => id !== avoid) ||
    available[0] ||
    "auto"
}
