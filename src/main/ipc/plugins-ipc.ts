import { ipcMain } from 'electron'
import { scanPlugins, validateManifest, getPluginContributions, listPluginRepositories, importPluginRepository } from '../runtime/plugin-manager'
import { installPlugin, uninstallPlugin, togglePlugin, listInstalledPlugins, getEnabledContributions } from '../runtime/plugin-manager-enhanced'

export function registerPluginsIpc(): void {
  ipcMain.handle("plugins:scan", (_e, workspaceRoot?: string) => scanPlugins(workspaceRoot))
  ipcMain.handle("plugins:validate", (_e, manifest: any) => validateManifest(manifest))
  ipcMain.handle("plugins:contributions", (_e, plugins: any[]) => getPluginContributions(plugins))
  ipcMain.handle("plugins:repositories", () => listPluginRepositories())
  ipcMain.handle("plugins:importRepository", (_e, input: any) => importPluginRepository(input))

  ipcMain.handle("plugins:install", (_e, manifest: any) => installPlugin(manifest))
  ipcMain.handle("plugins:uninstall", (_e, id: string) => uninstallPlugin(id))
  ipcMain.handle("plugins:toggle", (_e, id: string) => togglePlugin(id))
  ipcMain.handle("plugins:listInstalled", () => listInstalledPlugins())
  ipcMain.handle("plugins:enabledContributions", () => getEnabledContributions())
}
