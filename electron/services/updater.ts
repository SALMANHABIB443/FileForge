import type { UpdateStatus } from '../types'

export type UpdaterDriverEvent =
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'error'

type DriverHandler = (detail: unknown) => void

export interface UpdaterDriver {
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  quitAndInstall(): void
  on(event: UpdaterDriverEvent, handler: DriverHandler): void
}

export interface UpdaterController {
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  subscribe(listener: (status: UpdateStatus) => void): () => void
}

interface LooseEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): unknown
}

interface AutoUpdaterLike extends LooseEventEmitter {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(): void
}

/** Configures the real electron-updater instance: updates are never forced. */
export function configureAutoUpdater(updater: AutoUpdaterLike): AutoUpdaterLike {
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  return updater
}

/** Wraps electron-updater, forwarding its raw events to the controller. */
export async function createRealUpdaterDriver(): Promise<UpdaterDriver> {
  const { autoUpdater } = await import('electron-updater')
  const updater = configureAutoUpdater(autoUpdater as unknown as AutoUpdaterLike)
  return {
    checkForUpdates: () => updater.checkForUpdates() as Promise<void>,
    downloadUpdate: () => updater.downloadUpdate() as Promise<void>,
    quitAndInstall: () => updater.quitAndInstall(),
    on: (event, handler) => {
      const emitter = updater as LooseEventEmitter
      emitter.on(event, (...args: unknown[]) => handler(args[0]))
    },
  }
}

export interface MockUpdaterOptions {
  version: string
  releaseNotes?: string
  releaseDate?: string
  progressSteps?: number[]
  failCheck?: boolean
  failDownload?: boolean
}

/** Deterministic driver for automated verification without a release server. */
export function createMockUpdaterDriver(options: Partial<MockUpdaterOptions> = {}): UpdaterDriver {
  const handlers = new Map<UpdaterDriverEvent, DriverHandler[]>()
  const emit = (event: UpdaterDriverEvent, detail?: unknown): void => {
    for (const handler of handlers.get(event) ?? []) handler(detail)
  }
  const version = options.version ?? '9.9.9'

  return {
    async checkForUpdates() {
      if (options.failCheck) {
        emit('error', new Error('Mock update check failed'))
        return
      }
      emit('checking-for-update')
      emit('update-available', {
        version,
        releaseNotes: options.releaseNotes ?? 'Mock release notes for FileForge.',
        releaseDate: options.releaseDate ?? '2026-01-01T00:00:00.000Z',
      })
    },
    async downloadUpdate() {
      const total = 4096
      for (const percent of options.progressSteps ?? [10, 45, 80, 100]) {
        emit('download-progress', {
          percent,
          transferred: Math.round((percent / 100) * total),
          total,
          bytesPerSecond: 2048,
        })
      }
      if (options.failDownload) {
        emit('error', new Error('Mock update download failed'))
        return
      }
      emit('update-downloaded', { version })
    },
    quitAndInstall() {},
    on(event, handler) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
  }
}

/** electron-updater releaseNotes can be a string or an array of { version, note }. */
export function normalizeReleaseNotes(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (Array.isArray(raw)) {
    const notes = raw
      .map((entry): string | null => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const note = (entry as Record<string, unknown>).note
          if (typeof note === 'string' && note.trim().length > 0) return note.trim()
        }
        return null
      })
      .filter((note): note is string => note !== null)
    return notes.length > 0 ? notes.join('\n\n') : undefined
  }
  return undefined
}

/** Turns driver/downstream errors into a short, human-readable message. */
export function updaterErrorMessage(error: unknown): string {
  if (error == null) return 'Update failed. Please try again later.'
  const message =
    typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : String(error)
  const cleaned = message.replace(/^Error:\s*/i, '').trim()
  if (!cleaned) return 'Update failed. Please try again later.'
  if (/no published versions|latest\.yml/i.test(cleaned)) {
    return 'No update information was found. Check your connection and try again.'
  }
  return cleaned.length > 300 ? `${cleaned.slice(0, 300)}…` : cleaned
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function mapUpdaterEvent(event: UpdaterDriverEvent, detail: unknown): UpdateStatus | null {
  switch (event) {
    case 'checking-for-update':
      return { type: 'checking' }
    case 'update-not-available':
      return { type: 'notAvailable' }
    case 'update-available': {
      const info = (detail ?? {}) as Record<string, unknown>
      const version = typeof info.version === 'string' && info.version ? info.version : 'unknown'
      return {
        type: 'available',
        version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : undefined,
      }
    }
    case 'download-progress': {
      const progress = (detail ?? {}) as Record<string, unknown>
      return {
        type: 'downloading',
        percent: clampPercent(Number(progress.percent)),
        transferred: Number(progress.transferred) || 0,
        total: Number(progress.total) || 0,
        bytesPerSecond: Number(progress.bytesPerSecond) || 0,
      }
    }
    case 'update-downloaded': {
      const info = (detail ?? {}) as Record<string, unknown>
      const version = typeof info.version === 'string' && info.version ? info.version : 'unknown'
      return { type: 'downloaded', version }
    }
    case 'error':
      return { type: 'error', message: updaterErrorMessage(detail) }
    default:
      return null
  }
}

const ALL_EVENTS: UpdaterDriverEvent[] = [
  'checking-for-update',
  'update-available',
  'update-not-available',
  'download-progress',
  'update-downloaded',
  'error',
]

/**
 * Owns the update state machine. When `driver` is null (e.g. an unpackaged
 * development build) updates are unavailable and callers receive `dev`.
 */
export function createUpdaterController(driver: UpdaterDriver | null): UpdaterController {
  const listeners = new Set<(status: UpdateStatus) => void>()
  let last: UpdateStatus | null = null

  const emit = (status: UpdateStatus): void => {
    last = status
    for (const listener of listeners) listener(status)
  }

  if (driver) {
    for (const event of ALL_EVENTS) {
      driver.on(event, (detail) => {
        const status = mapUpdaterEvent(event, detail)
        if (status) emit(status)
      })
    }
  } else {
    emit({ type: 'dev' })
  }

  return {
    async check() {
      if (!driver) return
      await driver.checkForUpdates()
    },
    async download() {
      if (!driver) return
      await driver.downloadUpdate()
    },
    async install() {
      if (!driver) return
      driver.quitAndInstall()
    },
    subscribe(listener) {
      listeners.add(listener)
      if (last) listener(last)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}