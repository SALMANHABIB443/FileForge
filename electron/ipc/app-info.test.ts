import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IPC } from '../channels'
import { registerAppInfoHandlers } from './app-info'

const state = vi.hoisted(() => ({
  version: '1.2.3-test',
  platform: process.platform,
}))

const { handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return { handlers }
})

vi.mock('electron', () => ({
  app: {
    getVersion: () => state.version,
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

const h = (channel: string) => handlers.get(channel)!

describe('app-info IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    registerAppInfoHandlers()
  })

  it('registers version and platform channels', () => {
    expect(handlers.has(IPC.AppGetVersion)).toBe(true)
    expect(handlers.has(IPC.AppGetPlatform)).toBe(true)
  })

  it('returns the app version and platform', () => {
    expect(h(IPC.AppGetVersion)()).toBe(state.version)
    expect(h(IPC.AppGetPlatform)()).toBe(process.platform)
  })
})