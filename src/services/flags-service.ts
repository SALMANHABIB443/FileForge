export const FLAG_DEFINITIONS = [
  {
    key: 'experimentalFolderExtract',
    label: 'Extract folders directly to disk',
    description:
      'Uses the File System Access API to write extracted files to a folder you pick, when supported by your browser.',
    group: 'experimental',
  },
  {
    key: 'localUsageAnalytics',
    label: 'Local usage analytics',
    description:
      'Counts which tools you use most. Stored only on this device and never transmitted. Off by default.',
    group: 'privacy',
  },
] as const

export type FlagKey = (typeof FLAG_DEFINITIONS)[number]['key']
export type FlagGroup = (typeof FLAG_DEFINITIONS)[number]['group']

export const FLAG_GROUPS: Record<FlagGroup, string> = {
  experimental: 'Experimental',
  privacy: 'Privacy',
}

const STORAGE_KEY = 'fileforge_flags'

function defaults(): Record<FlagKey, boolean> {
  const base: Record<string, boolean> = {}
  for (const def of FLAG_DEFINITIONS) {
    base[def.key] = false
  }
  return base as Record<FlagKey, boolean>
}

export function getFlags(): Record<FlagKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const flags = defaults()
    for (const def of FLAG_DEFINITIONS) {
      flags[def.key] = parsed[def.key] === true
    }
    return flags
  } catch {
    return defaults()
  }
}

export function isFlagEnabled(key: FlagKey): boolean {
  return getFlags()[key] ?? false
}

export function setFlag(key: FlagKey, enabled: boolean): void {
  try {
    const flags = getFlags()
    flags[key] = enabled
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
  } catch {
    // storage unavailable — silently ignore
  }
}