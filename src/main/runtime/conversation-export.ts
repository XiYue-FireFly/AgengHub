/**
 * Conversation Export: export session history to Markdown / JSON / HTML.
 *
 * Reads from the runtime store and formats conversation data into
 * portable file formats. Supports tool call folding, thinking section
 * folding, and attachment links.
 */

import { writeFile } from 'node:fs/promises'
// join reserved for future path operations

export type ExportFormat = 'markdown' | 'json' | 'html'

export interface ExportMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  agentId?: string
  timestamp?: string
  toolCalls?: Array<{ name: string; args?: string; result?: string }>
  thinking?: string
  attachments?: Array<{ name: string; kind: string }>
}

export interface ExportData {
  version: 1
  title: string
  exportedAt: string
  messages: ExportMessage[]
  metadata?: {
    workspaceId?: string
    agentIds?: string[]
    turnCount?: number
  }
}

/**
 * Format conversation messages as Markdown.
 * Tool calls are wrapped in collapsible <details> blocks.
 * Thinking sections are folded.
 */
export function formatAsMarkdown(data: ExportData): string {
  const lines: string[] = []
  lines.push(`# ${data.title}`)
  lines.push(`_Exported: ${data.exportedAt}_\n`)

  for (const msg of data.messages) {
    const roleLabel = msg.role === 'user' ? '**User**' :
      msg.role === 'assistant' ? `**Assistant**${msg.agentId ? ` (${msg.agentId})` : ''}` :
      msg.role === 'system' ? '_System_' :
      '**Tool**'
    const time = msg.timestamp ? ` _${msg.timestamp}_` : ''
    lines.push(`### ${roleLabel}${time}\n`)

    if (msg.attachments?.length) {
      lines.push(`> Attachments: ${msg.attachments.map(a => a.name).join(', ')}\n`)
    }

    if (msg.thinking) {
      lines.push('<details><summary>Thinking</summary>\n')
      lines.push(msg.thinking)
      lines.push('\n</details>\n')
    }

    lines.push(msg.content || '_(empty)_')

    if (msg.toolCalls?.length) {
      for (const tc of msg.toolCalls) {
        lines.push(`\n<details><summary>Tool: ${tc.name}</summary>\n`)
        if (tc.args) lines.push(`**Args:**\n\`\`\`json\n${tc.args}\n\`\`\``)
        if (tc.result) lines.push(`\n**Result:**\n\`\`\`\n${tc.result}\n\`\`\``)
        lines.push('\n</details>')
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format conversation as standalone HTML.
 */
export function formatAsHtml(data: ExportData): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const msgHtml = data.messages.map(msg => {
    const roleClass = `msg-${msg.role}`
    const agentBadge = msg.agentId ? ` <span class="agent">${escape(msg.agentId)}</span>` : ''
    const thinking = msg.thinking ? `<details><summary>Thinking</summary><pre>${escape(msg.thinking)}</pre></details>` : ''
    const tools = (msg.toolCalls || []).map(tc =>
      `<details><summary>Tool: ${escape(tc.name)}</summary>${tc.args ? `<pre>${escape(tc.args)}</pre>` : ''}${tc.result ? `<pre>${escape(tc.result)}</pre>` : ''}</details>`
    ).join('')
    return `<div class="${roleClass}"><strong>${msg.role}${agentBadge}</strong>${msg.timestamp ? ` <time>${escape(msg.timestamp)}</time>` : ''}<div class="content">${escape(msg.content)}</div>${thinking}${tools}</div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escape(data.title)}</title>
<style>
body{font-family:system-ui;max-width:800px;margin:2em auto;padding:0 1em;line-height:1.6}
.msg-user{border-left:3px solid #3b82f6;padding-left:12px;margin:1em 0}
.msg-assistant{border-left:3px solid #10b981;padding-left:12px;margin:1em 0}
.msg-system{border-left:3px solid #f59e0b;padding-left:12px;margin:1em 0;opacity:0.7}
.msg-tool{border-left:3px solid #8b5cf6;padding-left:12px;margin:1em 0}
.agent{font-size:0.8em;opacity:0.6}time{font-size:0.8em;opacity:0.5}
details{margin:0.5em 0}summary{cursor:pointer;font-weight:600}
pre{background:rgba(0,0,0,0.05);padding:8px;border-radius:4px;overflow-x:auto;font-size:0.9em}
</style></head><body>
<h1>${escape(data.title)}</h1><p><em>Exported: ${escape(data.exportedAt)}</em></p>
${msgHtml}
</body></html>`
}

/**
 * Export conversation to a file.
 */
export async function exportConversation(
  data: ExportData,
  format: ExportFormat,
  outputPath: string
): Promise<{ ok: boolean; path: string; error?: string }> {
  try {
    let content: string
    if (format === 'markdown') content = formatAsMarkdown(data)
    else if (format === 'html') content = formatAsHtml(data)
    else content = JSON.stringify(data, null, 2)

    await writeFile(outputPath, content, 'utf-8')
    return { ok: true, path: outputPath }
  } catch (e: any) {
    return { ok: false, path: outputPath, error: e?.message || String(e) }
  }
}
