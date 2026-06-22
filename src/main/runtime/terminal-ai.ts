/**
 * Terminal AI: integration between terminal output and AI prompts.
 *
 * Provides functions to capture terminal context and construct
 * AI prompts that include command history and output.
 */

export interface TerminalContext {
  /** Recent command lines from the terminal */
  recentCommands: string[]
  /** Recent output lines */
  recentOutput: string[]
  /** Current working directory */
  cwd?: string
  /** Exit code of the last command */
  lastExitCode?: number
}

/**
 * Build a prompt that includes terminal context for AI analysis.
 */
export function buildTerminalPrompt(
  userPrompt: string,
  context: TerminalContext
): string {
  const parts: string[] = []

  if (context.cwd) parts.push(`Working directory: ${context.cwd}`)

  if (context.recentCommands.length > 0) {
    parts.push(`Recent commands:\n${context.recentCommands.map(c => `  $ ${c}`).join('\n')}`)
  }

  if (context.recentOutput.length > 0) {
    const output = context.recentOutput.slice(-50).join('\n')
    parts.push(`Recent output:\n\`\`\`\n${output}\n\`\`\``)
  }

  if (context.lastExitCode !== undefined && context.lastExitCode !== 0) {
    parts.push(`Last command exited with code ${context.lastExitCode}`)
  }

  parts.push(`Question: ${userPrompt}`)

  return parts.join('\n\n')
}

/**
 * Suggest a command based on user intent and terminal context.
 * Returns the prompt to send to the AI model.
 */
export function suggestCommandPrompt(
  intent: string,
  context: TerminalContext
): string {
  return buildTerminalPrompt(
    `Suggest a single terminal command for: ${intent}\n` +
    `Return ONLY the command, no explanation.`,
    context
  )
}

/**
 * Explain terminal output. Returns the prompt to send to the AI model.
 */
export function explainOutputPrompt(
  context: TerminalContext
): string {
  return buildTerminalPrompt(
    'Explain what this terminal output means and if there are any issues to address.',
    context
  )
}
