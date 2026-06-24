/**
 * Git IPC handlers.
 *
 * Extracted from index.ts to isolate all git-related IPC registrations.
 * These handlers delegate to the runtime/git module.
 */

import { ipcMain } from 'electron'
import {
  gitBranches,
  gitCheckoutBranch,
  gitCommit,
  gitCommitDetails,
  gitCommitDiff,
  gitCreateBranch,
  gitDeleteBranch,
  gitDiff,
  gitDiffs,
  gitFetch,
  gitLog,
  gitPull,
  gitPush,
  gitRenameBranch,
  gitRevertAll,
  gitRevertFile,
  gitStageAll,
  gitStageFile,
  gitStatus,
  gitSync,
  gitUnstageFile,
  gitUpdateBranch
} from '../runtime/git'

function sanitizeGitError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  // Strip potentially sensitive path info from git errors
  const sanitized = msg.replace(/[A-Z]:\\[^\s]+/gi, '<path>').replace(/\/home\/[^\s]+/g, '<path>')
  const err = new Error(sanitized)
  return err
}

function wrapGit<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => fn(...args).catch((e: unknown) => { throw sanitizeGitError(e) })) as unknown as T
}

export function registerGitIpc(): void {
  ipcMain.handle("git:status", (_event, workspaceId?: string | null) => gitStatus(workspaceId))
  ipcMain.handle("git:branches", (_event, workspaceId?: string | null) => gitBranches(workspaceId))
  ipcMain.handle("git:checkoutBranch", (_event, workspaceId: string | null, branch: string) => wrapGit(gitCheckoutBranch)(workspaceId, branch))
  ipcMain.handle("git:createBranch", (_event, workspaceId: string | null, branch: string, checkout?: boolean) => wrapGit(gitCreateBranch)(workspaceId, branch, checkout !== false))
  ipcMain.handle("git:renameBranch", (_event, workspaceId: string | null, oldName: string, newName: string) => wrapGit(gitRenameBranch)(workspaceId, oldName, newName))
  ipcMain.handle("git:deleteBranch", (_event, workspaceId: string | null, branch: string, force?: boolean) => wrapGit(gitDeleteBranch)(workspaceId, branch, !!force))
  ipcMain.handle("git:log", (_event, workspaceId?: string | null, limit?: number) => gitLog(workspaceId, limit))
  ipcMain.handle("git:diff", (_event, workspaceId?: string | null, filePath?: string) => gitDiff(workspaceId, filePath))
  ipcMain.handle("git:diffs", (_event, workspaceId?: string | null) => gitDiffs(workspaceId))
  ipcMain.handle("git:commitDetails", (_event, workspaceId: string | null, sha: string) => gitCommitDetails(workspaceId, sha))
  ipcMain.handle("git:commitDiff", (_event, workspaceId: string | null, sha: string, filePath?: string) => gitCommitDiff(workspaceId, sha, filePath))
  ipcMain.handle("git:stageFile", (_event, workspaceId: string | null, filePath: string) => wrapGit(gitStageFile)(workspaceId, filePath))
  ipcMain.handle("git:stageAll", (_event, workspaceId: string | null) => wrapGit(gitStageAll)(workspaceId))
  ipcMain.handle("git:unstageFile", (_event, workspaceId: string | null, filePath: string) => wrapGit(gitUnstageFile)(workspaceId, filePath))
  ipcMain.handle("git:revertFile", (_event, workspaceId: string | null, filePath: string) => wrapGit(gitRevertFile)(workspaceId, filePath))
  ipcMain.handle("git:revertAll", (_event, workspaceId: string | null) => wrapGit(gitRevertAll)(workspaceId))
  ipcMain.handle("git:commit", (_event, workspaceId: string | null, message: string, filePaths?: string[]) => wrapGit(gitCommit)(workspaceId, message, filePaths))
  ipcMain.handle("git:fetch", (_event, workspaceId: string | null, remote?: string) => wrapGit(gitFetch)(workspaceId, remote))
  ipcMain.handle("git:pull", (_event, workspaceId: string | null, remote?: string, branch?: string) => wrapGit(gitPull)(workspaceId, remote, branch))
  ipcMain.handle("git:push", (_event, workspaceId: string | null, remote?: string, branch?: string) => wrapGit(gitPush)(workspaceId, remote, branch))
  ipcMain.handle("git:sync", (_event, workspaceId: string | null) => wrapGit(gitSync)(workspaceId))
  ipcMain.handle("git:updateBranch", (_event, workspaceId: string | null, branch: string) => wrapGit(gitUpdateBranch)(workspaceId, branch))
}
