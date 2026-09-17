import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IPC } from '../channels'
import { registerIpcHandlers } from './index'

const state = vi.hoisted(() => ({
  version: '0.x',
  platform: process.platform,
}))

const { handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return { handlers }
})

vi.mock('electron', () => ({
  app: {
    getVersion: () => state.version,
    isPackaged: false,
  },
  BrowserWindow: {
    fromWebContents: () => null,
    getAllWindows: () => [],
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true, filePath: null }),
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
  shell: {
    openPath: async () => '',
    showItemInFolder: () => {},
  },
  Notification: { isSupported: () => false },
}))

describe('IPC registration entrypoint', () => {
  beforeEach(() => {
    handlers.clear()
    registerIpcHandlers()
  })

  it('registers channels from every handler module', () => {
    const required = [
      IPC.AppGetVersion,
      IPC.AppGetPlatform,
      IPC.WindowMinimize,
      IPC.WindowClose,
      IPC.FileSelectFiles,
      IPC.FileRead,
      IPC.FileSaveOutput,
      IPC.FileStat,
      IPC.ShellOpenPath,
      IPC.ShellShowItemInFolder,
      IPC.NotifyShow,
      IPC.UpdateCheck,
      IPC.UpdateDownload,
      IPC.UpdateInstall,
      IPC.EngineRun,
      IPC.EngineCancel,
    ]
    for (const channel of required) {
      expect(handlers.has(channel)).toBe(true)
    }
  })

  it('registers all unique channel names', () => {
    const names = [...handlers.keys()]
    expect(new Set(names).size).toBe(names.length)
  })
})