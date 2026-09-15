export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
  context?: string
  detail?: string
}

const MAX_LOGS = 500
const DB_NAME = 'fileforge-log'
const DB_VERSION = 1
const STORE = 'logs'

const logs: LogEntry[] = []

export interface AppVersionInfo {
  version: string
  userAgent: string
}

function memoryLog(entry: LogEntry): void {
  logs.push(entry)
  if (logs.length > MAX_LOGS) logs.shift()
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function persist(entry: LogEntry): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).add(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    await trimPersisted()
  } catch {
    // persistence is best-effort; never throw into callers
  }
}

async function trimPersisted(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const countReq = store.count()
      countReq.onsuccess = () => {
        const count = countReq.result
        if (count > MAX_LOGS) {
          const exceed = count - MAX_LOGS
          let removed = 0
          const cursorReq = store.openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (cursor && removed < exceed) {
              cursor.delete()
              removed++
              cursor.continue()
            }
          }
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

async function getAllPersisted(): Promise<LogEntry[]> {
  try {
    const db = await openDb()
    return await new Promise<LogEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve((req.result as LogEntry[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

function log(level: LogLevel, message: string, context?: string, detail?: string): void {
  const entry: LogEntry = { level, message, timestamp: Date.now(), context, detail }
  memoryLog(entry)
  void persist(entry)

  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  if (import.meta.env.DEV && !isTestEnv) {
    const prefix = context ? `[${context}]` : ''
    const method = level === 'debug' ? console.debug : level === 'warn' ? console.warn : level === 'error' ? console.error : console.info
    method(`${prefix} ${message}${detail ? ` — ${detail}` : ''}`)
  }
}

export interface ExportPayload {
  exportedAt: string
  version: string
  userAgent: string
  logs: LogEntry[]
}

export const logger = {
  debug: (message: string, context?: string, detail?: string) => log('debug', message, context, detail),
  info: (message: string, context?: string, detail?: string) => log('info', message, context, detail),
  warn: (message: string, context?: string, detail?: string) => log('warn', message, context, detail),
  error: (message: string, context?: string, detail?: string) => log('error', message, context, detail),

  getLogs: () => [...logs],

  /** Records a bold crash snapshot (metadata only — never file contents). */
  recordCrash(message: string, detail: string, app: AppVersionInfo): void {
    if (typeof navigator !== 'undefined') {
      app.userAgent = navigator.userAgent
    }
    log('error', `Crash snapshot — ${message}`, 'error-boundary', `${detail} [version=${app.version}][ua=${app.userAgent}]`)
  },

  /** Gathers persisted + session logs into one marriage payload (oldest first). */
  async buildExport(): Promise<ExportPayload> {
    const persisted = await getAllPersisted()
    const lastPersisted = persisted[persisted.length - 1]
    const lastPersistedAt = lastPersisted ? lastPersisted.timestamp : 0
    const newerSession = logs.filter((e) => e.timestamp > lastPersistedAt)
    const merged = [...persisted, ...newerSession]
    merged.sort((a, b) => a.timestamp - b.timestamp)
    return {
      exportedAt: new Date().toISOString(),
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      logs: merged,
    }
  },

  async clear(): Promise<void> {
    logs.length = 0
    try {
      const db = await openDb()
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      })
    } catch {
      // ignore
    }
  },
}