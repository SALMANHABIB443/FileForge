export interface Settings {
  storagePreference: 'download' | 'opfs' | 'ask'
  autoCleanup: boolean
  cleanupAgeDays: number
  defaultOutputDir: string
  maxConcurrentJobs: number
  resumePendingJobs: boolean
  notificationsEnabled: boolean
  autoCheckUpdates: boolean
  overwriteProtection: 'autorename' | 'confirm'
}

const DEFAULT_SETTINGS: Settings = {
  storagePreference: 'ask',
  autoCleanup: true,
  cleanupAgeDays: 30,
  defaultOutputDir: '',
  maxConcurrentJobs: 2,
  resumePendingJobs: true,
  notificationsEnabled: true,
  autoCheckUpdates: true,
  overwriteProtection: 'autorename',
}

const STORAGE_KEY = 'fileforge_settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function resetSettings(): Settings {
  localStorage.removeItem(STORAGE_KEY)
  return { ...DEFAULT_SETTINGS }
}