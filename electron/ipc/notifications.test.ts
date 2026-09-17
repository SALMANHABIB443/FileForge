import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IPC } from '../channels'
import { registerNotificationHandlers } from './notifications'

const { handlers, state, notification } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const state = {
    supported: true,
    constructed: [] as Array<{ title: string; body: string; silent: boolean }>,
    shown: 0,
    clickCb: null as (() => void) | null,
    focusTarget: {
      minimized: false,
      restored: 0,
      shown: 0,
      focused: 0,
      isMinimized: () => state.focusTarget.minimized,
      restore: () => {
        state.focusTarget.restored++
      },
      show: () => {
        state.focusTarget.shown++
      },
      focus: () => {
        state.focusTarget.focused++
      },
    },
  }
  const notificationMock = vi.fn().mockImplementation((opts: { title: string; body: string; silent: boolean }) => {
    state.constructed.push(opts)
    return {
      show: () => {
        state.shown++
      },
      on: (_event: string, cb: () => void) => {
        state.clickCb = cb
      },
      destroy: () => {},
    }
  })
  const notification = Object.assign(notificationMock, {
    isSupported: vi.fn(() => state.supported),
  })
  return { handlers, state, notification }
})

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => state.focusTarget },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
  Notification: notification,
}))

const h = (channel: string) => handlers.get(channel)!

describe('notification IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    state.constructed.length = 0
    state.shown = 0
    state.focusTarget.minimized = false
    state.focusTarget.restored = 0
    state.focusTarget.shown = 0
    state.focusTarget.focused = 0
    state.supported = true
    registerNotificationHandlers()
  })

  it('registers the notify channel', () => {
    expect(handlers.has(IPC.NotifyShow)).toBe(true)
  })

  it('shows a valid notification', () => {
    const result = h(IPC.NotifyShow)({ sender: {} }, { title: 'Done', body: 'Your files are ready.' })
    expect(result).toEqual({ ok: true, supported: true })
    expect(state.constructed).toHaveLength(1)
    expect(state.constructed[0]).toMatchObject({ title: 'Done', body: 'Your files are ready.', silent: false })
    expect(state.shown).toBe(1)
  })

  it('trims title and body before showing', () => {
    h(IPC.NotifyShow)({ sender: {} }, { title: '  Done  ', body: '  Hi  ' })
    expect(state.constructed[0]).toMatchObject({ title: 'Done', body: 'Hi' })
  })

  it('rejects invalid titles and bodies', () => {
    for (const bad of [
      undefined,
      null,
      'x',
      { body: 'b' },
      { title: '', body: 'b' },
      { title: 'a'.repeat(65), body: 'b' },
      { title: 'a', body: '' },
      { title: 'a', body: 'b'.repeat(301) },
    ]) {
      expect(() => h(IPC.NotifyShow)({ sender: {} }, bad)).toThrow()
    }
  })

  it('returns unsupported without showing when notifications are unavailable', () => {
    state.supported = false
    const result = h(IPC.NotifyShow)({ sender: {} }, { title: 'a', body: 'b' })
    expect(result).toEqual({ ok: false, supported: false })
    expect(state.shown).toBe(0)
  })

  it('focuses the owning window when the toast is clicked', () => {
    h(IPC.NotifyShow)({ sender: {} }, { title: 'a', body: 'b' })
    const click = state.clickCb!
    click()
    expect(state.focusTarget.shown).toBe(1)
    expect(state.focusTarget.focused).toBe(1)
    expect(state.focusTarget.restored).toBe(0)

    state.focusTarget.minimized = true
    click()
    expect(state.focusTarget.restored).toBe(1)
  })
})