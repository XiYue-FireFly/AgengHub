/**
 * IPC Registration Hub.
 *
 * Centralizes all IPC handler registrations from domain-specific modules.
 * This is the single entry point for all IPC setup.
 */

import { registerGitIpc } from './git-ipc'
import { registerMemoryIpc } from './memory-ipc'
import { registerProviderIpc } from './provider-ipc'
import { registerMcpIpc } from './mcp-ipc'
import { registerWorkflowIpc } from './workflow-ipc'
import { registerTerminalIpc } from './terminal-ipc'
import { registerBrowserIpc } from './browser-ipc'
import { registerConversationIpc } from './conversation-ipc'
import { registerPluginsIpc } from './plugins-ipc'
import { registerWorkspaceIpc } from './workspace-ipc'
import { registerPassthroughIpc } from './passthrough-ipc'
import { registerHubThreadsIpc } from './hub-threads-ipc'
import { registerMissingIpc } from './missing-ipc'
import { BrowserWindow } from 'electron'

interface IpcRegistrationDeps {
  memory: () => any
  providerMgr: any
  registerAgentsFromBindings: () => void
  resolveAppVersionFromMain: () => string
  getWorkspaceManager: () => any
  store: any
  registry: any
  runtimeStore: any
  dispatcher: any
  hub: any
  router: any
  proxy: any
  getMainWindow: () => BrowserWindow | null
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

  // MCP operations (7 handlers)
  registerMcpIpc()

  // Workflow/Feature operations (40+ handlers)
  registerWorkflowIpc({
    resolveAppVersionFromMain: deps.resolveAppVersionFromMain,
    getWorkspaceManager: deps.getWorkspaceManager,
    store: deps.store,
    memory: deps.memory,
    providerMgr: deps.providerMgr,
    registry: deps.registry
  })

  // Terminal operations (6 handlers)
  registerTerminalIpc()

  // Browser operations (5 handlers)
  registerBrowserIpc()

  // Conversation export/import (7 handlers)
  registerConversationIpc()

  // Plugin management (10 handlers)
  registerPluginsIpc()

  // Workspace, worktree, workspace files (14 handlers)
  registerWorkspaceIpc()

  // Simple passthrough handlers (~80 handlers)
  registerPassthroughIpc({
    memory: deps.memory,
    store: deps.store,
    runtimeStore: deps.runtimeStore,
    dispatcher: deps.dispatcher,
    registry: deps.registry,
    providerMgr: deps.providerMgr,
    resolveAppVersionFromMain: deps.resolveAppVersionFromMain,
    registerAgentsFromBindings: deps.registerAgentsFromBindings,
    getWorkspaceManager: deps.getWorkspaceManager,
    getMainWindow: deps.getMainWindow
  })

  // Hub, threads, runtime, context handlers (18 handlers)
  registerHubThreadsIpc({
    hub: deps.hub,
    dispatcher: deps.dispatcher,
    registry: deps.registry,
    router: deps.router,
    runtimeStore: deps.runtimeStore,
    memory: deps.memory,
    proxy: deps.proxy,
    getWorkspaceManager: deps.getWorkspaceManager
  })

  // Missing handlers: skills, agentic, app, proxy, takeover, AI quick-complete
  registerMissingIpc({
    dispatcher: deps.dispatcher,
    runtimeStore: deps.runtimeStore,
    registry: deps.registry,
    providerMgr: deps.providerMgr,
    proxy: deps.proxy,
    hub: deps.hub,
    getMainWindow: deps.getMainWindow,
    memory: deps.memory
  })
}
