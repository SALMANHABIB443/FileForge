import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkForUpdates,
  dismissUpdate,
  downloadUpdate,
  getUpdateState,
  initUpdater,
  installAndRestart,
  resetUpdaterForTests,
  subscribeUpdates,
} from '@/services/updater'
import type { UpdateStatus } from '../../electron/types'

let emitStatus: ((status: UpdateStatus) => void) | null = null

function createLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => void store.set(key, value),
    removeItem: (key: string): void => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
    get length(): number {
      return store.size
    },
  }
}

const local = createLocalStorage()

const bridge = {
  checkForUpdates: vi.fn(() => Promise.resolve()),
  downloadUpdate: vi.fn(() => Promise.resolve()),
  installAndRestart: vi.fn(() => Promise.resolve()),
  onUpdateStatus: vi.fn((callback: (status: UpdateStatus) => void) => {
    emitStatus = callback
    return () => {
      emitStatus = null
    }
  }),
}

function installDesktopEnv(autoCheck = true): void {
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true })
  local.clear()
  local.setItem('fileforge_settings', JSON.stringify({ autoCheckUpdates: autoCheck }))
  ;(globalThis as unknown as { window: unknown }).window = {
    fileforge: bridge,
    setTimeout: (cb: () => void, ms: number) => globalThis.setTimeout(cb, ms),
    clearTimeout: (id: number) => globalThis.clearTimeout(id),
  }
  emitStatus = null
}

function notify(status: UpdateStatus): void {
  emitStatus?.(status)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  resetUpdaterForTests()
  vi.useRealTimers()
})

describe('updater state', () => {
  it('starts idle', () => {
    installDesktopEnv()
    expect(getUpdateState()).toEqual({ type: 'idle' })
  })

  it('checkForUpdates marks checking and asks the bridge', () => {
    installDesktopEnv()
    checkForUpdates()
    expect(getUpdateState()).toEqual({ type: 'checking' })
    expect(bridge.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('throws when not on desktop', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true })
    local.clear()
    ;(globalThis as unknown as { window: unknown }).window = {}
    expect(() => checkForUpdates()).toThrow('only available in the desktop app')
    expect(() => downloadUpdate()).toThrow('only available in the desktop app')
    expect(() => installAndRestart()).toThrow('only available in the desktop app')
  })

  it('forwards bridge statuses into state', () => {
    installDesktopEnv()
    initUpdater()
    notify({ type: 'checking' })
    expect(getUpdateState().type).toBe('checking')
    notify({ type: 'notAvailable' })
    expect(getUpdateState().type).toBe('notAvailable')
    notify({ type: 'downloading', percent: 55, transferred: 1, total: 2, bytesPerSecond: 3 })
    expect(getUpdateState()).toMatchObject({ type: 'downloading', percent: 55 })
    notify({ type: 'error', message: 'net down' })
    expect(getUpdateState()).toEqual({ type: 'error', message: 'net down' })
  })

  it('explodes the availability state later', () => {
    installDesktopEnv()
    initUpdater()
    notify({
      type: 'available',
      version: '1.0.0',
      releaseNotes: 'Notes',
      releaseDate: '2026-09-01T00:00:00.000Z',
    })
    expect(getUpdateState()).toEqual({
      type: 'available',
      version: '1.0.0',
      releaseNotes: 'Notes',
      releaseDate: '2026-09-01T00:00:00.000Z',
    })
  })

  it('subscribeUpdates replays the current state to new listeners', () => {
    installDesktopEnv()
    const seen: string[] = []
    subscribeUpdates((s) => seen.push(s.type))
    expect(seen).toEqual(['idle'])
  })
})

describe('skip version', () => {
  it('dismissUpdate persists the version and suppresses re-announcements', () => {
    installDesktopEnv()
    initUpdater()
    notify({ type: 'available', version: '2.0.0' })
    dismissUpdate()
    expect(getUpdateState()).toEqual({ type: 'dismissed', version: '2.0.0' })
    expect(local.getItem('fileforge_skipped_update')).toBe('2.0.0')

    notify({ type: 'available', version: '2.0.0' })
    expect(getUpdateState()).toEqual({ type: 'dismissed', version: '2.0.0' })

    notify({ type: 'available', version: '3.0.0' })
    expect(getUpdateState()).toMatchObject({ type: 'available', version: '3.0.0' })
    expect(local.getItem('fileforge_skipped_update')).toBe('2.0.0')
  })

  it('download works after dismissal', () => {
    installDesktopEnv()
    initUpdater()
    notify({ type: 'available', version: '2.0.0' })
    dismissUpdate()
    downloadUpdate()
    expect(bridge.downloadUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('bridge actions', () => {
  it('downloadUpdate and installAndRestart call through', () => {
    installDesktopEnv()
    downloadUpdate()
    installAndRestart()
    expect(bridge.downloadUpdate).toHaveBeenCalledTimes(1)
    expect(bridge.installAndRestart).toHaveBeenCalledTimes(1)
  })
})

describe('initUpdater', () => {
  it('auto-checks after the startup delay when enabled', () => {
    vi.useFakeTimers()
    installDesktopEnv(true)
    initUpdater()
    expect(bridge.checkForUpdates).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(bridge.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(getUpdateState().type).toBe('checking')
  })

  it('does not auto-check when disabled in settings', () => {
    vi.useFakeTimers()
    installDesktopEnv(false)
    initUpdater()
    vi.advanceTimersByTime(10_000)
    expect(bridge.checkForUpdates).not.toHaveBeenCalled()
    expect(getUpdateState().type).toBe('idle')
  })

  it('is a no-op outside the desktop app', () => {
    vi.useFakeTimers()
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true })
    local.clear()
    ;(globalThis as unknown as { window: unknown }).window = {}
    initUpdater()
    vi.advanceTimersByTime(60_000)
    expect(bridge.onUpdateStatus).not.toHaveBeenCalled()
    expect(bridge.checkForUpdates).not.toHaveBeenCalled()
  })
})