/**
 * Orchestrate types: shared type definitions for orchestrate state.
 * Extracted from orchestrate-view.tsx to allow the component to be
 * removed while keeping the types available for dependents.
 */

export type OrchestrateSubtaskStatus = 'pending' | 'running' | 'done' | 'error'

export interface OrchestrateSubtask {
  id: string
  title: string
  detail?: string
  agentId?: string
  status: OrchestrateSubtaskStatus
  content?: string
  verdict?: { pass: boolean; note: string }
  startedAt?: number
  completedAt?: number
}

export interface OrchestrateState {
  phase: 'planning' | 'running' | 'synthesizing' | 'done' | 'error'
  subtasks: OrchestrateSubtask[]
  leadAgentId?: string
  final?: string
  error?: string
  startedAt?: number
  completedAt?: number
}
