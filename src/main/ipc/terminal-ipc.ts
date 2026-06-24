import { ipcMain } from 'electron'
import { getTerminalRuntime } from '../runtime/terminal'
import { buildTerminalPrompt, suggestCommandPrompt, explainOutputPrompt } from '../runtime/terminal-ai'

export function registerTerminalIpc(): void {
  ipcMain.handle("terminal:run", (_event, input: { workspaceId?: string | null; command: string }) => getTerminalRuntime().run(input))
  ipcMain.handle("terminal:cancel", (_event, runId: string) => getTerminalRuntime().cancel(runId))
  ipcMain.handle("terminal:history", () => getTerminalRuntime().history())

  ipcMain.handle("terminalAi:buildPrompt", (_e, userPrompt: string, context: any) => buildTerminalPrompt(userPrompt, context))
  ipcMain.handle("terminalAi:suggestCommand", (_e, intent: string, context: any) => suggestCommandPrompt(intent, context))
  ipcMain.handle("terminalAi:explainOutput", (_e, context: any) => explainOutputPrompt(context))
}
