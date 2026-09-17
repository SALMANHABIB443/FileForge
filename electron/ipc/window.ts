import { BrowserWindow, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC } from '../channels'

function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerWindowHandlers(): void {
  ipcMain.handle(IPC.WindowMinimize, (event) => {
    windowFromEvent(event)?.minimize()
  })

  ipcMain.handle(IPC.WindowMaximize, (event) => {
    const win = windowFromEvent(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.handle(IPC.WindowClose, (event) => {
    windowFromEvent(event)?.close()
  })

  ipcMain.handle(IPC.WindowIsMaximized, (event) => {
    return windowFromEvent(event)?.isMaximized() ?? false
  })
}