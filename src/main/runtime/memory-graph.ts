/**
 * Memory Graph: graph data structure for memory visualization.
 *
 * Builds a node-edge graph from memory entries where:
 * - Nodes = memory entries
 * - Edges = shared tags, shared category, or text similarity
 * Used by the renderer's Memory Graph visualization component.
 */

import type { MemoryEntry } from '../memory-library'

export interface GraphNode {
  id: string
  label: string
  category: string
  status: string
  pinned: boolean
  useCount: number
  /** Normalized importance score (0-1) */
  importance: number
  tags: string[]
}

export interface GraphEdge {
  source: string
  target: string
  /** Edge type: shared tag, same category, or text similarity */
  type: 'tag' | 'category' | 'similarity'
  /** Strength of connection (0-1) */
  weight: number
  /** Shared label for display */
  label?: string
}

export interface MemoryGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    isolatedNodes: number
    categories: Record<string, number>
  }
}

/**
 * Build a memory graph from a list of entries.
 */
export function buildMemoryGraph(entries: MemoryEntry[]): MemoryGraph {
  const nodes: GraphNode[] = entries.map(entry => ({
    id: entry.id,
    label: entry.title.slice(0, 60),
    category: entry.category,
    status: entry.status || 'approved',
    pinned: !!(entry.metadata?.pinned || entry.metadata?.pin),
    useCount: (entry.metadata?.useCount as number) || 0,
    importance: computeImportance(entry),
    tags: entry.tags || []
  }))

  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()

  // Build edges from shared tags
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const key = [a.id, b.id].sort().join('::')
      if (edgeSet.has(key)) continue

      // Shared tags
      const sharedTags = a.tags.filter(t => b.tags.includes(t))
      if (sharedTags.length > 0) {
        edgeSet.add(key)
        edges.push({
          source: a.id,
          target: b.id,
          type: 'tag',
          weight: Math.min(1, sharedTags.length * 0.3),
          label: sharedTags[0]
        })
        continue
      }

      // Same category
      if (a.category === b.category) {
        edgeSet.add(key)
        edges.push({
          source: a.id,
          target: b.id,
          type: 'category',
          weight: 0.15,
          label: a.category
        })
      }
    }
  }

  const connectedIds = new Set<string>()
  for (const edge of edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  const categories: Record<string, number> = {}
  for (const node of nodes) {
    categories[node.category] = (categories[node.category] || 0) + 1
  }

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      isolatedNodes: nodes.filter(n => !connectedIds.has(n.id)).length,
      categories
    }
  }
}

/**
 * Suggest entries to clean up: low importance, no connections, old.
 */
export function suggestCleanup(graph: MemoryGraph): GraphNode[] {
  const connectedIds = new Set(graph.edges.flatMap(e => [e.source, e.target]))
  return graph.nodes
    .filter(n => !n.pinned && n.status === 'approved')
    .filter(n => !connectedIds.has(n.id) && n.importance < 0.3 && n.useCount === 0)
    .sort((a, b) => a.importance - b.importance)
}

function computeImportance(entry: MemoryEntry): number {
  let score = 0
  if (entry.metadata?.pinned || entry.metadata?.pin) score += 0.4
  if (typeof entry.confidence === 'number') score += entry.confidence * 0.2
  const useCount = (entry.metadata?.useCount as number) || 0
  if (useCount) score += Math.min(0.3, useCount * 0.05)
  if (entry.category === 'preference' || entry.category === 'correction') score += 0.1
  return Math.min(1, score)
}
