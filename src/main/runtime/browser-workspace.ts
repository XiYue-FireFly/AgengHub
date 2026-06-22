/**
 * Browser Workspace: web page capture and interaction for AI context.
 *
 * Provides DOM snapshot extraction and page metadata for AI consumption.
 * Actual webview rendering is handled by the renderer; this module
 * processes captured data.
 */

export interface PageSnapshot {
  url: string
  title: string
  /** Text content of the page, truncated */
  textContent: string
  /** Key metadata */
  meta: {
    description?: string
    keywords?: string[]
    ogTitle?: string
    ogDescription?: string
  }
  /** Links found on the page */
  links: Array<{ text: string; href: string }>
  /** Whether the page has forms */
  hasForms: boolean
  /** Timestamp of capture */
  capturedAt: string
}

/**
 * Build a summary of a page snapshot for AI consumption.
 */
export function summarizePageSnapshot(snapshot: PageSnapshot): string {
  const parts: string[] = []
  parts.push(`Page: ${snapshot.title}`)
  parts.push(`URL: ${snapshot.url}`)

  if (snapshot.meta.description) parts.push(`Description: ${snapshot.meta.description}`)

  // Truncate text content for context window
  const maxText = 2000
  const text = snapshot.textContent.length > maxText
    ? snapshot.textContent.slice(0, maxText) + '...'
    : snapshot.textContent
  parts.push(`Content:\n${text}`)

  if (snapshot.links.length > 0) {
    const topLinks = snapshot.links.slice(0, 10)
    parts.push(`Links: ${topLinks.map(l => `${l.text} (${l.href})`).join(', ')}`)
  }

  if (snapshot.hasForms) parts.push('Note: Page contains interactive forms.')

  return parts.join('\n')
}

/**
 * Extract just the readable text from HTML (simple tag stripping).
 */
export function extractReadableText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000)
}

/**
 * Build an AI prompt from a page snapshot for analysis.
 */
export function buildPageAnalysisPrompt(
  snapshot: PageSnapshot,
  userRequest?: string
): string {
  const summary = summarizePageSnapshot(snapshot)
  const request = userRequest || 'Analyze this page and summarize its key content.'
  return `${summary}\n\nRequest: ${request}`
}
