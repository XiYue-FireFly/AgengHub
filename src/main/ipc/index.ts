/**
 * IPC Registration Hub.
 *
 * Centralizes all IPC handler registrations from domain-specific modules.
 * This is the single entry point for all IPC setup.
 */

import { registerGitIpc } from './git-ipc'
import { registerMemoryIpc } from './memory-ipc'
import { registerProviderIpc } from './provider-ipc'

interface IpcRegistrationDeps {
  memory: () => any
  providerMgr: any
  registerAgentsFromBindings: () => void
}

/**
 * Register all domain-specific IPC handlers.
 * This replaces the ~200 inline ipcMain.handle calls in index.ts.
 */
export function registerAllIpcHandlers(deps: IpcRegistrationDeps): void {
  // Git operations (22 handlers)
  registerGitIpc()

  // Memory operations (16 handlers)
  registerMemoryIpc(deps.memory)

  // Provider & Routing operations (17 handlers)
  registerProviderIpc({
    providerMgr: deps.providerMgr,
    registerAgentsFromBindings: deps.registerAgentsFromBindings
  })

  // TODO: Extract remaining IPC groups:
  // - hub-ipc.ts (threads, turns, runtime, context)
  // - mcp-ipc.ts (MCP servers, tools)
  // - workflow-ipc.ts (workflows, shortcuts, diagnostics, backup)
  // - terminal-ipc.ts (terminal, browser, inline-edit)
  // - thread-ipc.ts (threads, turns, runtime)
}
