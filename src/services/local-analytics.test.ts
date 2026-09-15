import { beforeEach, describe, expect, it } from 'vitest'
import { recordToolUse, getUsageCounts, clearUsageCounts } from '@/services/local-analytics'
import { setFlag } from '@/services/flags-service'

const store = new Map<string, string>()

function shimLocalStorage(): void {
  const mock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k)
    },
    setItem: (k, v) => {
      store.set(k, v)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true })
}

beforeEach(() => {
  store.clear()
  shimLocalStorage()
})

describe('local-analytics', () => {
  it('does not record when the analytics flag is off (default)', () => {
    recordToolUse('image-convert')
    expect(getUsageCounts()).toEqual({})
  })

  it('records tool uses when the analytics flag is on', () => {
    setFlag('localUsageAnalytics', true)
    recordToolUse('image-convert')
    recordToolUse('image-convert')
    recordToolUse('pdf-merge')
    expect(getUsageCounts()).toEqual({ 'image-convert': 2, 'pdf-merge': 1 })
  })

  it('acceptable toggling off stops recording but keeps existing counts', () => {
    setFlag('localUsageAnalytics', true)
    recordToolUse('image-convert')
    setFlag('localUsageAnalytics', false)
    recordToolUse('pdf-merge')
    expect(getUsageCounts()).toEqual({ 'image-convert': 1 })
  })

  it('clears all counts', () => {
    setFlag('localUsageAnalytics', true)
    recordToolUse('image-convert')
    clearUsageCounts()
    expect(getUsageCounts()).toEqual({})
  })
})