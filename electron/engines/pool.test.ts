import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'node:os'
import { runHeavy, shutdownHeavyPool } from './pool'
import type { EngineResult } from './types'

interface MockedWorker {
  listeners: Record<string, Array<(payload?: unknown) => void>>
  lastMessage: { [key: string]: unknown } | null
  messages: Array<{ type: string; requestId?: string }>
  opts?: { name?: string }
  terminated: boolean
  emit(event: string, payload?: unknown): void
  postMessage(msg: unknown): void
}

const { MockWorker } = vi.hoisted(() => {
  class MockWorker {
    static instances: MockedWorker[] = []
listeners: Record<string, Array<(payload?: unknown) => void>> = {}
    lastMessage: { [key: string]: unknown } | null = null
    messages: Array<{ type: string; requestId?: string }> = []
    terminated = false
constructor(public path: string, public opts?: { name?: string }) {
      MockWorker.instances.push(this as unknown as MockedWorker)
    }
    on(event: string, cb: (payload?: unknown) => void): void {
      ;(this.listeners[event] ??= []).push(cb)
    }
    emit(event: string, payload?: unknown): void {
      for (const cb of this.listeners[event] ?? []) cb(payload)
    }
postMessage(msg: unknown): void {
      this.lastMessage = msg as { [key: string]: unknown }
      const tagged = msg as { type: string; requestId?: string }
      if (typeof tagged?.type === 'string') this.messages.push(tagged)
    }
    async terminate(): Promise<void> {
      this.terminated = true
    }
  }
  return { MockWorker }
})

vi.mock('node:worker_threads', () => ({ Worker: MockWorker }))

const MAX_WORKERS = Math.max(1, Math.min(4, os.cpus().length - 1))

const fileResult: EngineResult = { kind: 'file', filename: 'out.png', outputPath: 'C:\\tmp\\out.png', outputSize: 42 }

function makeReq(extra: Record<string, unknown> = {}) {
  const onProgress = vi.fn()
  return {
    requestId: `r-${Math.random().toString(36).slice(2)}`,
    kind: 'image.compress',
    files: [{ path: 'C:\\a.png', name: 'a.png', size: 10 }],
    options: {},
    workDir: 'C:\\tmp\\jobs',
    onProgress,
    ...extra,
  } as Parameters<typeof runHeavy>[0] & { onProgress: ReturnType<typeof vi.fn> }
}

async function waitPosted(worker: MockedWorker): Promise<void> {
  await vi.waitFor(() => expect(worker.lastMessage).not.toBeNull())
}

describe('heavy worker pool', () => {
  beforeEach(() => {
    MockWorker.instances.length = 0
    shutdownHeavyPool()
  })

  afterEach(() => {
    shutdownHeavyPool()
    vi.restoreAllMocks()
  })

  it('spawns a worker and forwards progress and result', async () => {
    const req = makeReq()
    const promise = runHeavy(req)

    const worker = MockWorker.instances[0]!
    expect(worker.opts?.name).toBe('fileforge-engine')
    await waitPosted(worker)
    expect(worker.lastMessage!.type).toBe('run')
    expect((worker.lastMessage! as { requestId: string }).requestId).toBe(req.requestId)

    worker.emit('message', { type: 'progress', percent: 40, message: 'Working…', detail: { index: 1, total: 3 } })
    expect(req.onProgress).toHaveBeenCalledWith(40, 'Working…', { index: 1, total: 3 })

    worker.emit('message', { type: 'result', requestId: req.requestId, result: fileResult })
    await expect(promise).resolves.toEqual(fileResult)
  })

  it('rejects when the worker reports an error', async () => {
    const req = makeReq()
    const promise = runHeavy(req)
    const worker = MockWorker.instances[0]!
    await waitPosted(worker)
    worker.emit('message', { type: 'error', requestId: req.requestId, message: 'boom' })
    await expect(promise).rejects.toThrow('boom')
  })

  it('caps concurrent workers and services queued requests', async () => {
    const jobs = MAX_WORKERS + 2
    const requests: Array<ReturnType<typeof runHeavy>> = []
    for (let i = 0; i < jobs; i++) {
      requests.push(runHeavy(makeReq()))
      await waitPosted(MockWorker.instances[MockWorker.instances.length - 1]!)
    }
    expect(MockWorker.instances.length).toBe(MAX_WORKERS)

    const complete = async (worker: MockedWorker, promiseIndex: number) => {
      await waitPosted(worker)
      const requestId = (worker.lastMessage! as { requestId: string }).requestId
      worker.emit('message', { type: 'result', requestId, result: fileResult })
      await requests[promiseIndex]
    }

    for (let i = 0; i < MAX_WORKERS; i++) {
      await complete(MockWorker.instances[i]!, i)
    }

    for (let k = 0; k < jobs - MAX_WORKERS; k++) {
      const worker = MockWorker.instances[k % MAX_WORKERS]!
      await complete(worker, MAX_WORKERS + k)
    }
  })

  it('rejects a busy request when its worker crashes', async () => {
    const req = makeReq()
    const promise = runHeavy(req)
    const worker = MockWorker.instances[0]!
    await waitPosted(worker)
    worker.emit('error', new Error('segfault'))
    await expect(promise).rejects.toThrow(/engine crashed: segfault/i)
    expect(worker.terminated).toBe(true)
  })

  it('rejects a busy request when the worker exits unexpectedly', async () => {
    const req = makeReq()
    const promise = runHeavy(req)
    const worker = MockWorker.instances[0]!
    await waitPosted(worker)
    worker.emit('exit', 1)
    await expect(promise).rejects.toThrow(/terminated unexpectedly/i)
  })

  it('posts an abort message for already-aborted signals', async () => {
    const controller = new AbortController()
    controller.abort()
    const req = makeReq({ signal: controller.signal })
    const promise = runHeavy(req)
    const worker = MockWorker.instances[0]!
await waitPosted(worker)
    expect(worker.messages.map((m) => m.type)).toEqual(['abort', 'run'])
    expect(worker.messages[0]).toEqual({ type: 'abort', requestId: req.requestId })
    worker.emit('message', { type: 'error', requestId: req.requestId, message: 'cancelled' })
    await expect(promise).rejects.toThrow('cancelled')
  })

it('shutdownHeavyPool terminates all workers', async () => {
    runHeavy(makeReq())
    await vi.waitFor(() => {
      expect(MockWorker.instances).toHaveLength(1)
      expect(MockWorker.instances[0]!.lastMessage).not.toBeNull()
    })
    const worker = MockWorker.instances[0]!
    expect(worker.terminated).toBe(false)
    shutdownHeavyPool()
    expect(worker.terminated).toBe(true)
  })
})
