import type { FileMeta, Job, JobProgressDetail, JobStatus } from '@/types/job'

export interface PersistentJob {
  id: string
  toolId: string
  status: Extract<JobStatus, 'pending' | 'processing'>
  inputs: Array<{
    id: string
    name: string
    size: number
    type: string
    lastModified: number
    path?: string
  }>
  outputName?: string
  options: Record<string, unknown>
  createdAt: number
  progress: {
    percent: number
    message?: string
    index?: number
    total?: number
  }
}

const DB_NAME = 'fileforge_jobs'
const DB_VERSION = 1
const STORE_NAME = 'queued'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function serializeInputs(inputs: FileMeta[]): PersistentJob['inputs'] {
  return inputs.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    lastModified: f.lastModified,
    path: f.path,
  }))
}

export function deserializeInputs(inputs: PersistentJob['inputs']): FileMeta[] {
  return inputs.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    lastModified: f.lastModified,
    path: f.path,
  }))
}

export function persistableProgress(p: { percent: number; message?: string; index?: number; total?: number }): {
  percent: number
  message?: string
  index?: number
  total?: number
} {
  return { percent: p.percent, message: p.message, index: p.index, total: p.total }
}

export async function saveQueuedJob(
  job: Pick<Job, 'id' | 'toolId' | 'status' | 'inputs' | 'outputName' | 'options' | 'createdAt' | 'progress'>,
): Promise<void> {
  if (!isIndexedDbAvailable()) return
  if (job.status !== 'pending' && job.status !== 'processing') return
  try {
    const db = await openDB()
    const entry: PersistentJob = {
      id: job.id,
      toolId: job.toolId,
      status: job.status,
      inputs: serializeInputs(job.inputs),
      outputName: job.outputName,
      options: job.options,
      createdAt: job.createdAt,
      progress: persistableProgress(job.progress),
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // persistence is best-effort — queue still works without it
  }
}

export async function deleteQueuedJob(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // best-effort
  }
}

export async function loadQueuedJobs(): Promise<PersistentJob[]> {
  if (!isIndexedDbAvailable()) return []
  try {
    const db = await openDB()
    return await new Promise<PersistentJob[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve((request.result as PersistentJob[]) ?? [])
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

export async function clearQueuedJobs(): Promise<void> {
  if (!isIndexedDbAvailable()) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // best-effort
  }
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

/**
 * A restored/job is retryable when every input still points at a real source:
 * an on-disk path (desktop) or a live File handle (web, same session).
 */
export function isJobRetryable(job: Pick<Job, 'inputs'>): boolean {
  return job.inputs.length > 0 && job.inputs.every((f) => Boolean(f.path || f.file || f.handle))
}

export function detailOf(detail: JobProgressDetail | undefined): { index?: number; total?: number } | undefined {
  if (!detail || (detail.index === undefined && detail.total === undefined)) return undefined
  return { index: detail.index, total: detail.total }
}