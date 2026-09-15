import type { Job } from '@/types/job'
import { loadSettings } from '@/services/settings-service'

export interface HistoryEntry {
  id: string
  toolId: string
  inputNames: string[]
  inputSize: number
  outputName?: string
  status: 'completed' | 'failed'
  createdAt: number
}

const DB_NAME = 'fileforge_history'
const DB_VERSION = 1
const STORE_NAME = 'entries'
const MAX_DB_ENTRIES = 200

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function recordJob(job: Job): Promise<void> {
  if (job.status !== 'completed' && job.status !== 'failed') return
  const entry: HistoryEntry = {
    id: job.id,
    toolId: job.toolId,
    inputNames: job.inputs.map((f) => f.name),
    inputSize: job.inputs.reduce((sum, f) => sum + f.size, 0),
    outputName: job.outputName,
    status: job.status,
    createdAt: job.createdAt,
  }
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(entry)
  await pruneHistory(db)
}

async function pruneHistory(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('createdAt')
    const request = index.openCursor(null, 'prev')
    let count = 0
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      count++
      if (count > MAX_DB_ENTRIES) {
        cursor.delete()
      }
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getHistoryEntries(): Promise<HistoryEntry[]> {
  const db = await openDB()
  const settings = loadSettings()
  const cutoff = settings.autoCleanup
    ? Date.now() - settings.cleanupAgeDays * 24 * 60 * 60 * 1000
    : 0
  const results = await new Promise<HistoryEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('createdAt')
    const request = index.openCursor(null, 'prev')
    const rows: HistoryEntry[] = []
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        rows.push(cursor.value)
        cursor.continue()
      } else {
        resolve(rows)
      }
    }
    request.onerror = () => reject(request.error)
  })
  return cutoff > 0 ? results.filter((e) => e.createdAt >= cutoff) : results
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(id)
}

export async function clearHistory(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()
}
