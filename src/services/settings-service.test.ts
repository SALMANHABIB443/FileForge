import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, resetSettings, type Settings } from '@/services/settings-service'

function installLocalStorage(): void {
  const store = new Map<string, string>()
  const fake = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => void store.set(key, value),
    removeItem: (key: string): void => void store.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
}

describe('settings service', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it('returns defaults when nothing is stored', () => {
    const settings = loadSettings()
    expect(settings.storagePreference).toBe('ask')
    expect(settings.autoCleanup).toBe(true)
    expect(settings.notificationsEnabled).toBe(true)
    expect(settings.autoCheckUpdates).toBe(true)
    expect(settings.overwriteProtection).toBe('autorename')
  })

  it('round-trips saved settings', () => {
    const settings: Settings = loadSettings()
    settings.notificationsEnabled = false
    settings.overwriteProtection = 'confirm'
    settings.maxConcurrentJobs = 4
    settings.autoCheckUpdates = false
    saveSettings(settings)
    const restored = loadSettings()
    expect(restored.notificationsEnabled).toBe(false)
    expect(restored.overwriteProtection).toBe('confirm')
    expect(restored.maxConcurrentJobs).toBe(4)
    expect(restored.autoCheckUpdates).toBe(false)
  })

  it('merges stored settings over defaults for new fields', () => {
    localStorage.setItem('fileforge_settings', JSON.stringify({ overwriteProtection: 'confirm' }))
    const settings = loadSettings()
    expect(settings.overwriteProtection).toBe('confirm')
    expect(settings.notificationsEnabled).toBe(true)
    expect(settings.resumePendingJobs).toBe(true)
  })

  it('falls back to defaults on malformed storage', () => {
    localStorage.setItem('fileforge_settings', '{not json')
    const settings = loadSettings()
    expect(settings.notificationsEnabled).toBe(true)
    expect(settings.overwriteProtection).toBe('autorename')
  })

  it('resets to defaults', () => {
    const settings: Settings = loadSettings()
    settings.overwriteProtection = 'confirm'
    saveSettings(settings)
    const reset = resetSettings()
    expect(reset.overwriteProtection).toBe('autorename')
    expect(reset.notificationsEnabled).toBe(true)
    // reset removes the stored key entirely
    expect(localStorage.getItem('fileforge_settings')).toBeNull()
  })
})