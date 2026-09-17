import { isDesktop } from '@/services/file-service'
import { loadSettings } from '@/services/settings-service'
import type { UpdateStatus } from '../../electron/types'

export type UpdatesState =
  | { type: 'idle' }
  | { type: 'dev' }
  | { type: 'checking' }
  | { type: 'notAvailable' }
  | { type: 'available'; version: string; releaseNotes?: string; releaseDate?: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'dismissed'; version: string }

const SKIP_KEY = 'fileforge_skipped_update'
const AUTO_CHECK_DELAY_MS = 10_000

const listeners = new Set<(state: UpdatesState) => void>()
let state: UpdatesState = { type: 'idle' }
let bridgeSubscription: (() => void) | null = null
let pendingAutoCheck: number | null = null

function setState(next: UpdatesState): void {
  state = next
  for (const listener of listeners) listener(next)
}

function getSkippedVersion(): string | null {
  try {
    const raw = localStorage.getItem(SKIP_KEY)
    return raw ? raw : null
  } catch {
    return null
  }
}

function setSkippedVersion(version: string): void {
  try {
    localStorage.setItem(SKIP_KEY, version)
  } catch {
    // storage unavailable — dismissal simply won't persist
  }
}

function applyStatus(status: UpdateStatus): void {
  if (status.type === 'available') {
    if (getSkippedVersion() === status.version) {
      setState({ type: 'dismissed', version: status.version })
      return
    }
    setState(status)
    return
  }
  setState(status)
}

function requireBridge(): void {
  if (!isDesktop() || !window.fileforge) {
    throw new Error('Auto-update is only available in the desktop app')
  }
}

/** Current update state. */
export function getUpdateState(): UpdatesState {
  return state
}

/** Subscribes to update state changes; calls the listener immediately. */
export function subscribeUpdates(listener: (state: UpdatesState) => void): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

/** Manually asks the main process to check for updates. */
export function checkForUpdates(): void {
  requireBridge()
  setState({ type: 'checking' })
  void window.fileforge!.checkForUpdates()
}

/** Downloads a previously announced update. */
export function downloadUpdate(): void {
  requireBridge()
  void window.fileforge!.downloadUpdate()
}

/** Installs the downloaded update and restarts the app. */
export function installAndRestart(): void {
  requireBridge()
  void window.fileforge!.installAndRestart()
}

/** Dismisses the announced version so it is not suggested on future checks. */
export function dismissUpdate(): void {
  if (state.type !== 'available') return
  setSkippedVersion(state.version)
  setState({ type: 'dismissed', version: state.version })
}

/**
 * Hooks the renderer up to the main-process updater. When "check on startup"
 * is enabled, a check is triggered a few seconds after launch so it never
 * competes with startup work. Idempotent.
 */
export function initUpdater(): void {
  if (!isDesktop() || bridgeSubscription) return
  bridgeSubscription = window.fileforge!.onUpdateStatus((status) => applyStatus(status))
  if (loadSettings().autoCheckUpdates) {
    pendingAutoCheck = window.setTimeout(() => {
      pendingAutoCheck = null
      if (loadSettings().autoCheckUpdates) checkForUpdates()
    }, AUTO_CHECK_DELAY_MS)
  }
}

/** Test helper — tears down subscriptions and timers. */
export function resetUpdaterForTests(): void {
  if (pendingAutoCheck !== null) {
    window.clearTimeout(pendingAutoCheck)
    pendingAutoCheck = null
  }
  bridgeSubscription?.()
  bridgeSubscription = null
  listeners.clear()
  state = { type: 'idle' }
}