/**
 * Provider & Routing IPC handlers.
 *
 * Extracted from index.ts to isolate provider management IPC registrations.
 * Dependencies are injected at registration time.
 */

import { ipcMain } from 'electron'

interface ProviderIpcDeps {
  providerMgr: any
  registerAgentsFromBindings: () => void
}

export function registerProviderIpc(deps: ProviderIpcDeps): void {
  const { providerMgr, registerAgentsFromBindings } = deps

  ipcMain.handle("providers:get", async () => providerMgr.getConfig())
  ipcMain.handle("providers:upsert", async (_e, p) => { providerMgr.upsertProvider(p); registerAgentsFromBindings(); return providerMgr.getConfig() })
  ipcMain.handle("providers:delete", async (_e, id) => { const ok = providerMgr.deleteProvider(id); if (ok) registerAgentsFromBindings(); return ok })
  ipcMain.handle("providers:setEnabled", async (_e, id, enabled) => { providerMgr.setProviderEnabled(id, enabled); return providerMgr.getConfig() })
  ipcMain.handle("providers:setKey", async (_e, id, key) => {
    providerMgr.setProviderApiKey(id, key)
    if (key) await providerMgr.fetchModels(id).catch(() => null)
    registerAgentsFromBindings()
    return providerMgr.getConfig()
  })
  ipcMain.handle("providers:fetchModels", async (_e, id) => {
    const r = await providerMgr.fetchModels(id)
    return { ...r, config: providerMgr.getConfig() }
  })
  ipcMain.handle("providers:health", async (_e, id) => providerMgr.checkProviderHealth(id))
  ipcMain.handle("providers:healthAll", async () => {
    const results: any = {}
    for (const p of providerMgr.getProviders()) {
      results[p.id] = await providerMgr.checkProviderHealth(p.id)
    }
    return results
  })

  // Routing
  ipcMain.handle("routing:setBinding", async (_e, b) => { providerMgr.upsertBinding(b); registerAgentsFromBindings(); return providerMgr.getBindings() })
  ipcMain.handle("routing:removeBinding", async (_e, agentId) => { providerMgr.removeBinding(agentId); registerAgentsFromBindings(); return providerMgr.getBindings() })
  ipcMain.handle("routing:setFallback", async (_e, chain) => { providerMgr.setFallbackChain(chain); return providerMgr.getConfig().routing })
  ipcMain.handle("routing:setStrategy", async (_e, s) => { providerMgr.setStrategy(s); return providerMgr.getConfig().routing })
  ipcMain.handle("routing:setBindingThinking", async (_e, agentId, t) => { providerMgr.setBindingThinking(agentId, t); return providerMgr.getBindings() })
  ipcMain.handle("routing:setProviderThinking", async (_e, id, t) => { providerMgr.setProviderThinking(id, t); return providerMgr.getConfig() })
  ipcMain.handle("routing:activeBinding", async (_e, agentId) => { providerMgr.setActiveBinding(agentId); return providerMgr.getConfig().activeBindingId })
}
