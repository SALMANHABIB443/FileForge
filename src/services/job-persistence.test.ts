import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  serializeInputs,
  deserializeInputs,
  persistableProgress,
  saveQueuedJob,
  loadQueuedJobs,
  deleteQueuedJob,
  clearQueuedJobs,
  isJobRetryable,
  detailOf,
} from '@/services/job-persistence'
import type { FileMeta, Job } from '@/types/job'

function makeFile(overrides?: Partial<FileMeta>): FileMeta {
  return {
    id: `f_${Math.random()}`,
    name: 'a.png',
    size: 100,
    type: 'image/png',
    lastModified: Date.now(),
    ...overrides,
  }
}

function pendingJob(id: string, inputs: FileMeta[]): Pick<Job, 'id' | 'toolId' | 'status' | 'inputs' | 'outputName' | 'options' | 'createdAt' | 'progress'> {
  return {
    id,
    toolId: 'image-convert',
    status: 'pending',
    inputs,
    outputName: 'out.zip',
    options: { format: 'jpeg' },
    createdAt: Date.now(),
    progress: { percent: 10, message: 'Starting…', index: 1, total: 2 },
  }
}

describe('serializeInputs / deserializeInputs', () => {
  it('keeps the on-disk path and drops live file handles', () => {
    const src = makeFile({ path: 'C:\\tmp\\a.png' })
    const serialized = serializeInputs([src])
    expect(serialized[0]!.path).toBe('C:\\tmp\\a.png')
    expect(deserializeInputs(serialized)[0]!.path).toBe('C:\\tmp\\a.png')
  })

  it('round-trips web-only metadata', () => {
    const src = [makeFile({ name: 'photo.jpg', size: 42 }) ]
    const restored = deserializeInputs(serializeInputs(src))
    expect(restored[0]!.name).toBe('photo.jpg')
    expect(restored[0]!.size).toBe(42)
  })
})

describe('persistableProgress / detailOf', () => {
  it('keeps index/total with the batch message', () => {
    const p = persistableProgress({ percent: 50, message: 'b', index: 2, total: 4 })
    expect(p.index).toBe(2)
    expect(p.total).toBe(4)
  })

  it('detailOf returns undefined when no detail is present', () => {
    expect(detailOf(undefined)).toBeUndefined()
    expect(detailOf({})).toBeUndefined()
    expect(detailOf({ index: 3, total: 5 })).toEqual({ index: 3, total: 5 })
  })
})

describe('queued-job persistence', () => {
  beforeEach(async () => {
    await clearQueuedJobs()
  })

  it('saves and loads pending and processing jobs', async () => {
    await saveQueuedJob(pendingJob('j1', [makeFile({ path: 'x' })]))
    await saveQueuedJob({ ...pendingJob('j2', [makeFile({ path: 'y' })]), status: 'processing' })

    const loaded = await loadQueuedJobs()
    expect(loaded.map((j) => j.id).sort()).toEqual(['j1', 'j2'])
    const j2 = loaded.find((j) => j.id === 'j2')!
    expect(j2.status).toBe('processing')
    expect(j2.toolId).toBe('image-convert')
    expect(j2.inputs[0]!.path).toBe('y')
  })

  it('ignores terminal jobs', async () => {
    await saveQueuedJob({ ...pendingJob('jF', [makeFile()]), status: 'failed' })
    expect(await loadQueuedJobs()).toHaveLength(0)
  })

  it('deletes a job by id', async () => {
    await saveQueuedJob(pendingJob('j3', [makeFile({ path: 'z' })]))
    await deleteQueuedJob('j3')
    expect(await loadQueuedJobs()).toHaveLength(0)
  })
})

describe('isJobRetryable', () => {
  it('requires every input to have a real source', () => {
    expect(isJobRetryable({ inputs: [makeFile({ path: 'C:\\a.png' })] })).toBe(true)
    expect(isJobRetryable({ inputs: [makeFile({ file: new File(['x'], 'a.png') })] })).toBe(true)
    expect(isJobRetryable({ inputs: [makeFile()] })).toBe(false)
    expect(isJobRetryable({ inputs: [] })).toBe(false)
  })
})