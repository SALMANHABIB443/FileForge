import { describe, it, expect } from 'vitest'
import {
  configureAutoUpdater,
  createMockUpdaterDriver,
  createUpdaterController,
  mapUpdaterEvent,
  normalizeReleaseNotes,
  updaterErrorMessage,
  type UpdaterDriver,
} from './updater'
import type { UpdateStatus } from '../types'

describe('normalizeReleaseNotes', () => {
  it('passes a trimmed plain string through', () => {
    expect(normalizeReleaseNotes('  v1 changes  ')).toBe('v1 changes')
    expect(normalizeReleaseNotes('')).toBeUndefined()
    expect(normalizeReleaseNotes('   ')).toBeUndefined()
  })

  it('joins array-style release notes', () => {
    const notes = [
      { version: '0.2.0', note: 'First line' },
      { version: '0.2.1', note: '' },
      { version: '0.2.2', note: 'Second line' },
    ]
    expect(normalizeReleaseNotes(notes)).toBe('First line\n\nSecond line')
  })

  it('returns undefined for empty arrays and non-matching shapes', () => {
    expect(normalizeReleaseNotes([])).toBeUndefined()
    expect(normalizeReleaseNotes([{ version: '0.2.0' }])).toBeUndefined()
    expect(normalizeReleaseNotes(42)).toBeUndefined()
    expect(normalizeReleaseNotes(undefined)).toBeUndefined()
  })
})

describe('updaterErrorMessage', () => {
  it('produces a generic message for missing errors', () => {
    expect(updaterErrorMessage(null)).toBe('Update failed. Please try again later.')
    expect(updaterErrorMessage(undefined)).toBe('Update failed. Please try again later.')
    expect(updaterErrorMessage('')).toBe('Update failed. Please try again later.')
  })

  it('strips the Error: prefix', () => {
    expect(updaterErrorMessage(new Error('Error: boom'))).toBe('boom')
    expect(updaterErrorMessage('Error: boom')).toBe('boom')
  })

  it('explains missing update metadata', () => {
    expect(updaterErrorMessage(new Error('Cannot find latest.yml'))).toBe(
      'No update information was found. Check your connection and try again.',
    )
  })

  it('caps overly long messages', () => {
    const long = 'x'.repeat(500)
    expect(updaterErrorMessage(long).length).toBe(301)
  })
})

describe('mapUpdaterEvent', () => {
  it('maps trivial events', () => {
    expect(mapUpdaterEvent('checking-for-update', undefined)).toEqual({ type: 'checking' })
    expect(mapUpdaterEvent('update-not-available', undefined)).toEqual({ type: 'notAvailable' })
    expect(mapUpdaterEvent('error', new Error('nope'))).toEqual({
      type: 'error',
      message: 'nope',
    })
  })

  it('normalizes update-available info', () => {
    const status = mapUpdaterEvent('update-available', {
      version: '1.2.3',
      releaseNotes: [{ version: '1.2.3', note: 'Shiny' }],
      releaseDate: '2026-09-01T00:00:00.000Z',
    })
    expect(status).toEqual({
      type: 'available',
      version: '1.2.3',
      releaseNotes: 'Shiny',
      releaseDate: '2026-09-01T00:00:00.000Z',
    })
  })

  it('falls back to an unknown version label', () => {
    expect(mapUpdaterEvent('update-available', {})?.type).toBe('available')
  })

  it('clamps download progress percent', () => {
    const status = mapUpdaterEvent('download-progress', {
      percent: 150,
      transferred: 100,
      total: 200,
      bytesPerSecond: 10,
    })
    expect(status).toMatchObject({ type: 'downloading', percent: 100 })
  })

  it('recognizes falsy progress values', () => {
    const status = mapUpdaterEvent('download-progress', { percent: NaN, total: 0 })
    expect(status).toMatchObject({ type: 'downloading', percent: 0, total: 0 })
  })
})

describe('configureAutoUpdater', () => {
  it('disables auto download and auto install', () => {
    const updater = configureAutoUpdater({
      autoDownload: true,
      autoInstallOnAppQuit: true,
      checkForUpdates: async () => {},
      downloadUpdate: async () => {},
      quitAndInstall: () => {},
      on: () => {},
    })
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
  })
})

describe('createUpdaterController', () => {
  function collectStatuses(driver: UpdaterDriver | null): {
    controller: ReturnType<typeof createUpdaterController>
    statuses: UpdateStatus[]
  } {
    const controller = createUpdaterController(driver)
    const statuses: UpdateStatus[] = []
    controller.subscribe((status) => statuses.push(status))
    return { controller, statuses }
  }

  it('emits dev status when no driver is available', () => {
    const { statuses } = collectStatuses(null)
    expect(statuses[0]).toEqual({ type: 'dev' })
  })

  it('replays the last status to late subscribers', async () => {
    const driver = createMockUpdaterDriver()
    const controller = createUpdaterController(driver)
    await controller.check()
    const late: UpdateStatus[] = []
    controller.subscribe((status) => late.push(status))
    expect(late[late.length - 1]).toMatchObject({ type: 'available', version: '9.9.9' })
  })

  it('drives checking → available → downloading → downloaded', async () => {
    const { controller, statuses } = collectStatuses(createMockUpdaterDriver())
    await controller.check()
    await controller.download()
    expect(statuses.map((s) => s.type)).toEqual([
      'checking',
      'available',
      'downloading',
      'downloading',
      'downloading',
      'downloading',
      'downloaded',
    ])
  })

  it('surfaces check errors via the mock driver', async () => {
    const { controller, statuses } = collectStatuses(createMockUpdaterDriver({ failCheck: true }))
    await controller.check()
    expect(statuses.at(-1)).toMatchObject({ type: 'error' })
    expect(statuses.at(-1)).toMatchObject({
      message: expect.stringContaining('Mock update check failed'),
    })
  })

  it('surfaces download errors without marking the update installed', async () => {
    const { controller, statuses } = collectStatuses(
      createMockUpdaterDriver({ failDownload: true, progressSteps: [50] }),
    )
    await controller.check()
    await controller.download()
    expect(statuses.at(-1)).toMatchObject({ type: 'error' })
  })

  it('no-ops check/download/install when no driver exists', async () => {
    const { controller, statuses } = collectStatuses(null)
    await controller.check()
    await controller.download()
    await controller.install()
    expect(statuses).toEqual([{ type: 'dev' }])
  })

  it('unsubscribes listeners', async () => {
    const driver = createMockUpdaterDriver()
    const controller = createUpdaterController(driver)
    const seen: string[] = []
    const unsubscribe = controller.subscribe((status) => seen.push(status.type))
    unsubscribe()
    await controller.check()
    expect(seen.length).toBe(0)
  })
})