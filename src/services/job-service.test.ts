import { describe, it, expect, beforeEach } from 'vitest'
import {
  createJob,
  getJob,
  cancelJob,
  failJob,
  updateJobProgress,
  updateJobStatus,
  deleteJob,
} from '@/services/job-service'
import type { FileMeta } from '@/types/job'

function makeFileMeta(overrides?: Partial<FileMeta>): FileMeta {
  return {
    id: 'test_file_1',
    name: 'test.jpg',
    size: 1024,
    type: 'image/jpeg',
    lastModified: Date.now(),
    ...overrides,
  }
}

describe('JobService', () => {
  beforeEach(() => {
    // Each test gets fresh state since jobs is module-level
    // We rely on unique IDs from createJob
  })

  it('creates a job with pending status', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    expect(job.status).toBe('pending')
    expect(job.toolId).toBe('image-convert')
    expect(job.progress).toEqual({ percent: 0 })
  })

  it('retrieves a job by id', () => {
    const job = createJob({ toolId: 'pdf-merge', inputs: [makeFileMeta()] })
    const found = getJob(job.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(job.id)
  })

  it('updates job status to processing', () => {
    const job = createJob({ toolId: 'zip-extract', inputs: [makeFileMeta()] })
    const updated = updateJobStatus(job.id, 'processing')
    expect(updated.status).toBe('processing')
  })

  it('updates job progress', () => {
    const job = createJob({ toolId: 'image-compress', inputs: [makeFileMeta()] })
    const updated = updateJobProgress(job.id, 50, 'Processing...')
    expect(updated.progress).toEqual({ percent: 50, message: 'Processing...' })
  })

  it('completes a job', () => {
    const job = createJob({ toolId: 'image-resize', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'processing')
    const completed = updateJobStatus(job.id, 'completed')
    expect(completed.status).toBe('completed')
  })

  it('fails a job with error message', () => {
    const job = createJob({ toolId: 'pdf-split', inputs: [makeFileMeta()] })
    const failed = failJob(job.id, 'Unsupported format')
    expect(failed.status).toBe('failed')
    expect(failed.error).toBe('Unsupported format')
  })

  it('cancels a pending job', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    const cancelled = cancelJob(job.id)
    expect(cancelled.status).toBe('cancelled')
  })

  it('cancels a processing job', () => {
    const job = createJob({ toolId: 'video-compress', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'processing')
    const cancelled = cancelJob(job.id)
    expect(cancelled.status).toBe('cancelled')
  })

  it('does not cancel a completed job', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'completed')
    const result = cancelJob(job.id)
    expect(result.status).toBe('completed')
  })

  it('does not cancel a failed job', () => {
    const job = createJob({ toolId: 'pdf-merge', inputs: [makeFileMeta()] })
    failJob(job.id, 'Error')
    const result = cancelJob(job.id)
    expect(result.status).toBe('failed')
  })

  it('deletes a job', () => {
    const job = createJob({ toolId: 'zip-create', inputs: [makeFileMeta()] })
    const deleted = deleteJob(job.id)
    expect(deleted).toBe(true)
    expect(getJob(job.id)).toBeUndefined()
  })

  it('throws when updating non-existent job', () => {
    expect(() => updateJobStatus('fake-id', 'processing')).toThrow('Job fake-id not found')
  })

  it('stores options on the job', () => {
    const job = createJob({
      toolId: 'image-convert',
      inputs: [makeFileMeta()],
      options: { format: 'png', quality: 90 },
    })
    expect(job.options).toEqual({ format: 'png', quality: 90 })
  })
})
