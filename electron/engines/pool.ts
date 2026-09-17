import { Worker } from 'node:worker_threads'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import type { EngineInputFile, EngineKind, EngineOptions, EngineResult } from './types'
import type { WorkerMessage, WorkerStartRequest } from './worker-src/protocol'

export interface HeavyRequest {
  requestId: string
  kind: EngineKind
  files: EngineInputFile[]
  options: EngineOptions
  workDir: string
  ffmpegPath?: string
  signal?: AbortSignal
  onProgress?: (percent: number, message?: string, detail?: { index?: number; total?: number }) => void
}

type Finish = (message: WorkerMessage) => void

interface WorkerHandle {
  worker: Worker
  busy: boolean
  requestId: string | null
  onProgress?: (percent: number, message?: string, detail?: { index?: number; total?: number }) => void
  finish?: Finish
}

const MAX_WORKERS = Math.max(1, Math.min(4, os.cpus().length - 1))

const handles: WorkerHandle[] = []
const waiters: Array<(handle: WorkerHandle) => void> = []

function handleMessage(handle: WorkerHandle, message: WorkerMessage): void {
  if (message.type === 'progress') {
    handle.onProgress?.(message.percent, message.message, message.detail)
    return
  }
  if (!handle.busy) return
  handle.busy = false
  handle.requestId = null
  const finish = handle.finish
  handle.finish = undefined
  handle.onProgress = undefined
  finish?.(message)
  serveNext(handle)
}

function serveNext(handle: WorkerHandle): void {
  const waiter = waiters.shift()
  if (waiter) waiter(handle)
}

function handleCrashed(handle: WorkerHandle, message: string): void {
  const index = handles.indexOf(handle)
  if (index !== -1) handles.splice(index, 1)
  if (handle.busy) {
    handle.busy = false
    const finish = handle.finish
    handle.finish = undefined
    handle.onProgress = undefined
    finish?.({ type: 'error', requestId: handle.requestId ?? '', message })
  }
  void handle.worker.terminate().catch(() => {})
  serveNext(handle)
}

function spawnWorker(): WorkerHandle {
  const workerPath = fileURLToPath(new URL('./worker.js', import.meta.url))
  const worker = new Worker(workerPath, { name: 'fileforge-engine' })
  const handle: WorkerHandle = {
    worker,
    busy: false,
    requestId: null,
  }
  handles.push(handle)
  worker.on('message', (msg: WorkerMessage) => handleMessage(handle, msg))
  worker.on('error', (err) => handleCrashed(handle, `Engine crashed: ${err.message}`))
  handle.worker.on('exit', (code) => {
    if (code !== 0 && handle.busy) {
      handleCrashed(handle, 'Engine terminated unexpectedly')
    }
  })
  return handle
}

function acquire(): Promise<WorkerHandle> {
  return new Promise((resolve) => {
    const free = handles.find((h) => !h.busy)
    if (free) {
      resolve(free)
      return
    }
    if (handles.length < MAX_WORKERS) {
      resolve(spawnWorker())
      return
    }
    waiters.push(resolve)
  })
}

export async function runHeavy(req: HeavyRequest): Promise<EngineResult> {
  const handle = await acquire()
  handle.busy = true
  handle.requestId = req.requestId
  handle.onProgress = req.onProgress

  const request: WorkerStartRequest = {
    type: 'run',
    requestId: req.requestId,
    kind: req.kind as WorkerStartRequest['kind'],
    files: req.files,
    options: req.options,
    workDir: req.workDir,
    ffmpegPath: req.ffmpegPath,
  }

  return new Promise<EngineResult>((resolve, reject) => {
    const onAbort = () => {
      handle.worker.postMessage({ type: 'abort', requestId: req.requestId })
    }
    if (req.signal) {
      if (req.signal.aborted) {
        onAbort()
      } else {
        req.signal.addEventListener('abort', onAbort)
      }
    }

    handle.finish = (message: WorkerMessage) => {
      if (req.signal) req.signal.removeEventListener('abort', onAbort)
      if (message.type === 'result') {
        resolve(message.result as EngineResult)
      } else {
        reject(new Error(message.message))
      }
    }

    handle.worker.postMessage(request)
  })
}

export function shutdownHeavyPool(): void {
  for (const h of handles) {
    void h.worker.terminate()
  }
  handles.length = 0
}