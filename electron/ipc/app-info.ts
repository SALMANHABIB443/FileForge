import { app, ipcMain } from 'electron'
import { IPC } from '../channels'

export function registerAppInfoHandlers(): void {
  ipcMain.handle(IPC.AppGetVersion, () => app.getVersion())

  ipcMain.handle(IPC.AppGetPlatform, () => process.platform)
}