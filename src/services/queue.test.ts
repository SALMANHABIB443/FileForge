import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  enqueueJob,
  retryJob,
  cancelQueuedJob,
  deleteJobFromQueue,
  getIncompleteJobs,
  initQueue,
  isRetryable,
} from '@/services/queue'
import { getJob, getAllJobs } from '@/services/job-service'
import { registerTool } from '@/services/tool-registry'
import type { FileMeta } from '@/types/job'

function tick(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function makeDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function makeInputs(names: string[]): FileMeta[] {
  return names.map((name, i) => ({
    id: `q_${name}`,
    name,
    size: 16,
    type: 'text/plain',
    lastModified: 0,
    path: `C:\\queue\\test\\${i}_${name}`,
  }))
}

beforeEach(async () => {
  await initQueue()
})

describe('queue scheduling', () => {
  it('runs at most maxConcurrentJobs (default 2) at once and finishes in order', async () => {
    const gate = makeDeferred()
    let active = 0
    registerTool({
      id: 'queue-concurrency',
      name: 'queue-concurrency',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          active++
          try {
            await gate.promise
            return { blob: new Blob(['ok']), filename: 'out.txt' }
          } finally {
            active--
          }
        },
      },
    })

    const a = enqueueJob({ toolId: 'queue-concurrency', inputs: makeInputs(['a.txt']) })
    const b = enqueueJob({ toolId: 'queue-concurrency', inputs: makeInputs(['b.txt']) })
    const c = enqueueJob({ toolId: 'queue-concurrency', inputs: makeInputs(['c.txt']) })

    expect(active).toBe(2)
    const queued = getIncompleteJobs().map((j) => j.id)
    expect(queued).toContain(c.id)

    gate.resolve()
    await tick(40)

    expect(active).toBe(0)
    for (const job of [a, b, c]) {
      expect(getJob(job.id)!.status).toBe('completed')
    }
  })

  it('lets a pending job be cancelled before it starts', async () => {
    const gate = makeDeferred()
    registerTool({
      id: 'queue-cancel',
      name: 'queue-cancel',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          await gate.promise
          return { blob: new Blob(['ok']), filename: 'out.txt' }
        },
      },
    })

    const a = enqueueJob({ toolId: 'queue-cancel', inputs: makeInputs(['a.txt']) })
    const b = enqueueJob({ toolId: 'queue-cancel', inputs: makeInputs(['b.txt']) })
    const c = enqueueJob({ toolId: 'queue-cancel', inputs: makeInputs(['c.txt']) })

    expect(getJob(c.id)!.status).toBe('pending')
    cancelQueuedJob(c.id)
    expect(getJob(c.id)!.status).toBe('cancelled')

    gate.resolve()
    await tick(40)

    expect(getJob(a.id)!.status).toBe('completed')
    expect(getJob(b.id)!.status).toBe('completed')
    expect(getJob(c.id)!.status).toBe('cancelled')
    expect(getIncompleteJobs().map((j) => j.id)).not.toContain(c.id)
  })
})

describe('retry and delete', () => {
  it('retryJob creates a new pending job with the same inputs and bumped retryCount', async () => {
    let shouldFail = true
    registerTool({
      id: 'queue-retry',
      name: 'queue-retry',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          if (shouldFail) throw new Error('boom')
          return { blob: new Blob(['x']), filename: 'ok.txt' }
        },
      },
    })

    // restore settings-friendly default and run the failure path
    const first = enqueueJob({ toolId: 'queue-retry', inputs: makeInputs(['a.txt']) })
    await tick(30)
    expect(getJob(first.id)!.status).toBe('failed')

    expect(isRetryable(getJob(first.id)!)).toBe(true)
    shouldFail = false
    const retried = retryJob(first.id)!
    expect(retried.id).not.toBe(first.id)
    expect(retried.retryCount).toBe(1)
    expect(retried.inputs.map((f) => f.name)).toEqual(['a.txt'])

    await tick(30)
    expect(getJob(retried.id)!.status).toBe('completed')
  })

  it('deleteJobFromQueue removes a job from memory and the queue', () => {
    const job = enqueueJob({ toolId: 'queue-retry', inputs: makeInputs(['del.txt']) })
    expect(getAllJobs().some((j) => j.id === job.id)).toBe(true)
    expect(deleteJobFromQueue(job.id)).toBe(true)
    expect(getAllJobs().some((j) => j.id === job.id)).toBe(false)
    expect(getIncompleteJobs().map((j) => j.id)).not.toContain(job.id)
  })
it('maps a BatchError from an engine into failedFiles on the job', async () => {
    registerTool({
      id: 'queue-batcherror',
      name: 'queue-batcherror',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          const { BatchError } = await import('@/utils/batch-error')
          throw new BatchError('2 of 3 files failed and were skipped.', {
            failedFiles: [
              { name: 'bad.png', error: 'decode failed' },
              { name: 'worse.png', error: 'too large' },
            ],
            details: 'bad.png: decode failed\nworse.png: too large',
          })
        },
      },
    })

    const job = enqueueJob({ toolId: 'queue-batcherror', inputs: makeInputs(['a.png', 'b.png', 'c.png']) })
    await tick(30)

    const result = getJob(job.id)!
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/2 of 3 files failed/)
    expect(result.failedFiles).toHaveLength(2)
    expect(result.failedFiles![1]).toEqual({ name: 'worse.png', error: 'too large' })
    expect(result.errorDetails).toContain('decode failed')
  })
})