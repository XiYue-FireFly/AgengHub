/**
 * Local Usage Scanner: scan Claude Code JSONL session files for usage statistics.
 *
 * Inspired by CCGUI's local_usage.rs scan_claude_file() and scan_claude_projects().
 * Scans ~/.claude/projects/ directories for .jsonl files and extracts token usage.
 *
 * R15: Local CLI session scanning for unified usage statistics.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, basename } from "node:path"
import { homedir } from "node:os"

export interface LocalUsageRecord {
  /** Source of the usage record */
  source: "local-claude-session"
  /** ISO timestamp of the record */
  createdAt: string
  /** Day key in YYYY-MM-DD format */
  dayKey: string
  /** Model used (if available) */
  modelId?: string
  /** Input tokens */
  inputTokens: number
  /** Output tokens */
  outputTokens: number
  /** Cache read tokens */
  cacheReadTokens: number
  /** Cache creation tokens */
  cacheCreationTokens: number
  /** Total tokens */
  totalTokens: number
  /** Project path (encoded directory name) */
  projectPath?: string
  /** Session file path */
  sessionPath: string
}

export interface LocalUsageScanResult {
  records: LocalUsageRecord[]
  diagnostics: {
    scannedFiles: number
    parsedRecords: number
    errors: string[]
    durationMs: number
  }
}

/** Maximum JSONL line size to process (512 KB, matching CCGUI) */
const MAX_LINE_SIZE = 512_000

/** Maximum sessions to scan (matching CCGUI) */
const MAX_SESSIONS = 200

/**
 * Scan Claude Code JSONL session files for usage statistics.
 *
 * @param days - Number of days to look back (default: 30)
 * @param workspacePath - Optional workspace path to filter by
 * @returns Scan result with records and diagnostics
 */
export function scanClaudeLocalUsage(days = 30, workspacePath?: string): LocalUsageScanResult {
  const start = Date.now()
  const errors: string[] = []
  let scannedFiles = 0
  let parsedRecords = 0

  const projectsDir = join(homedir(), ".claude", "projects")
  if (!existsSync(projectsDir)) {
    return { records: [], diagnostics: { scannedFiles: 0, parsedRecords: 0, errors: ["~/.claude/projects/ not found"], durationMs: Date.now() - start } }
  }

  const dayKeys = makeDayKeys(days)
  const daySet = new Set(dayKeys)
  const records: LocalUsageRecord[] = []

  try {
    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => join(projectsDir, entry.name))

    for (const projectDir of projectDirs) {
      if (records.length >= MAX_SESSIONS) break

      // If workspacePath is specified, only scan matching project directory
      if (workspacePath) {
        const encoded = encodeClaudeProjectPath(workspacePath)
        if (basename(projectDir) !== encoded) continue
      }

      try {
        const files = readdirSync(projectDir)
          .filter(name => name.endsWith(".jsonl") && !name.startsWith("agent-"))
          .map(name => join(projectDir, name))

        for (const filePath of files) {
          if (records.length >= MAX_SESSIONS) break
          scannedFiles++

          try {
            const fileRecords = scanClaudeFile(filePath, daySet)
            records.push(...fileRecords)
            parsedRecords += fileRecords.length
          } catch (e: any) {
            errors.push(`Error scanning ${filePath}: ${e?.message || String(e)}`)
          }
        }
      } catch (e: any) {
        errors.push(`Error reading ${projectDir}: ${e?.message || String(e)}`)
      }
    }
  } catch (e: any) {
    errors.push(`Error reading ${projectsDir}: ${e?.message || String(e)}`)
  }

  return {
    records: records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    diagnostics: { scannedFiles, parsedRecords, errors, durationMs: Date.now() - start }
  }
}

/**
 * Scan a single Claude Code JSONL file for usage statistics.
 * Claude Code format has token info in message.usage and model in message.model
 */
function scanClaudeFile(filePath: string, daySet: Set<string>): LocalUsageRecord[] {
  const records: LocalUsageRecord[] = []
  const content = readFileSync(filePath, "utf-8")
  const lines = content.split("\n")

  for (const line of lines) {
    if (line.length > MAX_LINE_SIZE) continue
    if (!line.trim()) continue

    let value: any
    try {
      value = JSON.parse(line)
    } catch {
      continue
    }

    const entryType = value?.type || ""

    // Only process assistant messages which contain usage info
    if (entryType !== "assistant") continue

    const message = value?.message
    if (!message || typeof message !== "object") continue

    const model = message.model || undefined
    const usage = message.usage
    if (!usage || typeof usage !== "object") continue

    const inputTokens = Number(usage.input_tokens) || 0
    const outputTokens = Number(usage.output_tokens) || 0
    const cacheRead = Number(usage.cache_read_input_tokens) || 0
    const cacheCreation = Number(usage.cache_creation_input_tokens) || 0

    // Skip if no meaningful usage
    if (inputTokens === 0 && outputTokens === 0) continue

    // Get timestamp
    const timestamp = value.timestamp || value.created_at || message.created_at
    if (!timestamp) continue

    let createdAt: string
    if (typeof timestamp === "number") {
      createdAt = new Date(timestamp).toISOString()
    } else if (typeof timestamp === "string") {
      createdAt = timestamp
    } else {
      continue
    }

    const dayKey = createdAt.slice(0, 10)
    if (!daySet.has(dayKey)) continue

    records.push({
      source: "local-claude-session",
      createdAt,
      dayKey,
      modelId: model,
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      totalTokens: inputTokens + outputTokens,
      sessionPath: filePath
    })
  }

  return records
}

/**
 * Encode a filesystem path to Claude's project directory name.
 * All non-alphanumeric characters (except hyphens) become hyphens.
 * Matches CCGUI's encode_claude_project_path().
 */
function encodeClaudeProjectPath(path: string): string {
  return path
    .replace(/^[A-Z]:/, m => m.toLowerCase()) // normalize drive letter
    .split("")
    .map(c => (/[a-z0-9-]/i.test(c) ? c : "-"))
    .join("")
}

/**
 * Generate day keys for the last N days in YYYY-MM-DD format.
 */
function makeDayKeys(days: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    keys.push(d.toISOString().slice(0, 10))
  }
  return keys
}
