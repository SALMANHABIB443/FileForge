import { isFlagEnabled } from '@/services/flags-service'

const STORAGE_KEY = 'fileforge_analytics'

/** Counts a tool use only when the local analytics flag is enabled. Never transmitted. */
export function recordToolUse(toolId: string): void {
  if (!isFlagEnabled('localUsageAnalytics')) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const counts: Record<string, number> = raw ? JSON.parse(raw) : {}
    counts[toolId] = (counts[toolId] ?? 0) + 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  } catch {
    // storage unavailable — silently ignore
  }
}

export function getUsageCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function clearUsageCounts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}