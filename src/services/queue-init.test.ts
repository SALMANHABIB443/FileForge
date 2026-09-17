import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { initQueue, getIncompleteJobs, getTerminalJobs } from '@/services/queue'
import { getJob } from '@/services/job-service'
import { registerTool } from '@/services/tool-registry'
import { saveQueuedJob } from '@/services/job-persistence'
import type { FileMeta } from '@/types/job'

function tick(ms = 40): Promise<void> {
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

describe('initQueue restore', () => {
  it('auto-resumes pending jobs and fails interrupted processing jobs on restart', async () => {
    const gate = makeDeferred()
    registerTool({
      id: 'queue-restore',
      name: 'queue-restore',
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

    await saveQueuedJob({
      id: 'restored-pending',
      toolId: 'queue-restore',
      status: 'pending',
      inputs: makeInputs(['a.txt']),
      options: {},
      createdAt: Date.now(),
      progress: { percent: 0 },
    })
    await saveQueuedJob({
      id: 'restored-processing',
      toolId: 'queue-restore',
      status: 'processing',
      inputs: makeInputs(['b.txt']),
      options: {},
      createdAt: Date.now(),
      progress: { percent: 45 },
    })

    await initQueue()

    const pending = getJob('restored-pending')!
    expect(pending.status).toBe('processing')

    const interrupted = getJob('restored-processing')!
    expect(interrupted.status).toBe('failed')
    expect(interrupted.interrupted).toBe(true)

    gate.resolve()
    await tick()

    expect(getJob('restored-pending')!.status).toBe('completed')
    expect(getTerminalJobs().some((j) => j.id === 'restored-processing')).toBe(true)
    expect(getIncompleteJobs().map((j) => j.id)).not.toContain('restored-pending')
  })
})