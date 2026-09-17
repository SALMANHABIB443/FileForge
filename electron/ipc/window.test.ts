import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IPC } from '../channels'
import { registerWindowHandlers } from './window'

const { handlers, win } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const win = {
    minimized: 0,
    maximizedFlag: false,
    unmaximized: 0,
    closed: 0,
    isMaximized: () => win.maximizedFlag,
    minimize: () => {
      win.minimized++
    },
    maximize: () => {
      win.maximizedFlag = true
    },
    unmaximize: () => {
      win.unmaximized++
      win.maximizedFlag = false
    },
    close: () => {
      win.closed++
    },
  }
  return { handlers, win }
})

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => win },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

const h = (channel: string) => handlers.get(channel)!
const event = { sender: {} }

describe('window IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    win.minimized = 0
    win.maximizedFlag = false
    win.unmaximized = 0
    win.closed = 0
    registerWindowHandlers()
  })

  it('registers the four window channels', () => {
    expect(handlers.has(IPC.WindowMinimize)).toBe(true)
    expect(handlers.has(IPC.WindowMaximize)).toBe(true)
    expect(handlers.has(IPC.WindowClose)).toBe(true)
    expect(handlers.has(IPC.WindowIsMaximized)).toBe(true)
  })

  it('minimize and close delegate to the window', () => {
    h(IPC.WindowMinimize)(event)
    h(IPC.WindowClose)(event)
    expect(win.minimized).toBe(1)
    expect(win.closed).toBe(1)
  })

  it('maximize toggles and reports new state', () => {
    expect(h(IPC.WindowMaximize)(event)).toBe(true)
    expect(h(IPC.WindowMaximize)(event)).toBe(false)
    expect(win.unmaximized).toBe(1)
  })

  it('isMaximized reflects the window state', () => {
    expect(h(IPC.WindowIsMaximized)(event)).toBe(false)
    h(IPC.WindowMaximize)(event)
    expect(h(IPC.WindowIsMaximized)(event)).toBe(true)
  })
})