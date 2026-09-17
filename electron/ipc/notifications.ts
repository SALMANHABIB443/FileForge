import { BrowserWindow, ipcMain, Notification } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC } from '../channels'
import type { NotifyRequest, NotifyResult } from '../types'

const MAX_TITLE = 64
const MAX_BODY = 300

function assertNotifyRequest(raw: unknown): NotifyRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid notification request')
  }
  const record = raw as Record<string, unknown>
  const title = record.title
  const body = record.body
  if (typeof title !== 'string' || title.trim() === '' || title.length > MAX_TITLE) {
    throw new Error(`title must be a non-empty string up to ${MAX_TITLE} characters`)
  }
  if (typeof body !== 'string' || body.trim() === '' || body.length > MAX_BODY) {
    throw new Error(`body must be a non-empty string up to ${MAX_BODY} characters`)
  }
  return { title: title.trim(), body: body.trim() }
}

export function registerNotificationHandlers(): void {
  ipcMain.handle(IPC.NotifyShow, (event: IpcMainInvokeEvent, raw: unknown): NotifyResult => {
    if (!Notification.isSupported()) {
      return { ok: false, supported: false }
    }
    const request = assertNotifyRequest(raw)
    const notification = new Notification({ title: request.title, body: request.body, silent: false })
    notification.on('click', () => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })
    notification.show()
    return { ok: true, supported: true }
  })
}