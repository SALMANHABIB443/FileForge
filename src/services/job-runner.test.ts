import { describe, it, expect } from 'vitest'
import { createJob, getJob, cancelJob, completeJob, deleteJob } from '@/services/job-service'
import type { FileMeta } from '@/types/job'

function makeFile(overrides?: Partial<FileMeta>): FileMeta {
  return {
    id: `test_${Date.now()}_${Math.random()}`,
    name: 'test.pdf',
    size: 2048,
    type: 'application/pdf',
    lastModified: Date.now(),
    ...overrides,
  }
}

describe('completeJob', () => {
  it('sets status to completed with output', () => {
    const job = createJob({ toolId: 'pdf-merge', inputs: [makeFile()] })
    const completed = completeJob(job.id, 'merged.pdf', new Blob(['data'], { type: 'application/pdf' }))
    expect(completed.status).toBe('completed')
    expect(completed.outputName).toBe('merged.pdf')
    expect(completed.outputBlob).toBeInstanceOf(Blob)
    expect(completed.outputUrl).toMatch(/^blob:/)
  })

  it('sets progress to 100 on completion', () => {
    const job = createJob({ toolId: 'pdf-split', inputs: [makeFile()] })
    const completed = completeJob(job.id, 'split.pdf', new Blob(['data']))
    expect(completed.progress.percent).toBe(100)
  })
})

describe('multi-input jobs', () => {
  it('creates a job with multiple inputs', () => {
    const job = createJob({
      toolId: 'pdf-merge',
      inputs: [
        makeFile({ name: 'a.pdf' }),
        makeFile({ name: 'b.pdf' }),
      ],
    })
    expect(job.inputs.length).toBe(2)
    expect(job.inputs[0]!.name).toBe('a.pdf')
    expect(job.inputs[1]!.name).toBe('b.pdf')
  })
})

describe('cancelJob edge cases', () => {
  it('does not throw when cancelling an already-cancelled job', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFile()] })
    cancelJob(job.id)
    const again = cancelJob(job.id)
    expect(again.status).toBe('cancelled')
  })

  it('does not throw when deleting a non-existent job', () => {
    expect(deleteJob('fake-id')).toBe(false)
  })
})

describe('getJob returns undefined for unknown id', () => {
  it('returns undefined for nonexistent job', () => {
    expect(getJob('no_such_id')).toBeUndefined()
  })
})
