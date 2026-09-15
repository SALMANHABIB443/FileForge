import type { Job, JobCreateInput, JobStatus } from '@/types/job'

type JobListener = (job: Job) => void

const jobs = new Map<string, Job>()
const listeners = new Map<string, Set<JobListener>>()
const globalListeners = new Set<JobListener>()

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function notify(job: Job): void {
  const jobListeners = listeners.get(job.id)
  if (jobListeners) {
    for (const fn of jobListeners) fn(job)
  }
  for (const fn of globalListeners) fn(job)
}

function updateJob(id: string, patch: Partial<Job>): Job {
  const job = jobs.get(id)
  if (!job) throw new Error(`Job ${id} not found`)
  const updated = { ...job, ...patch, updatedAt: Date.now() }
  jobs.set(id, updated)
  notify(updated)
  return updated
}

export function createJob(input: JobCreateInput): Job {
  const id = generateJobId()
  const now = Date.now()
  const job: Job = {
    id,
    toolId: input.toolId,
    status: 'pending',
    inputs: input.inputs,
    outputName: input.outputName,
    options: input.options ?? {},
    progress: { percent: 0 },
    createdAt: now,
    updatedAt: now,
  }
  jobs.set(id, job)
  notify(job)
  return job
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function updateJobStatus(id: string, status: JobStatus): Job {
  return updateJob(id, { status })
}

export function updateJobProgress(id: string, percent: number, message?: string): Job {
  return updateJob(id, { progress: { percent, message } })
}

export function failJob(id: string, error: string): Job {
  return updateJob(id, { status: 'failed', error })
}

export function completeJob(id: string, outputName: string, blob: Blob): Job {
  const url = URL.createObjectURL(blob)
  return updateJob(id, {
    status: 'completed',
    outputName,
    outputBlob: blob,
    outputUrl: url,
    progress: { percent: 100 },
  })
}

export function cancelJob(id: string): Job {
  const job = jobs.get(id)
  if (!job) throw new Error(`Job ${id} not found`)
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return job
  }
  const controller = abortControllers.get(id)
  if (controller) {
    controller.abort()
  }
  return updateJob(id, { status: 'cancelled' })
}

export function deleteJob(id: string): boolean {
  const job = jobs.get(id)
  if (!job) return false
  if (job.outputUrl) {
    URL.revokeObjectURL(job.outputUrl)
  }
  const controller = abortControllers.get(id)
  if (controller) {
    controller.abort()
    abortControllers.delete(id)
  }
  jobs.delete(id)
  listeners.delete(id)
  return true
}

export function subscribeToJob(id: string, fn: JobListener): () => void {
  if (!listeners.has(id)) listeners.set(id, new Set())
  listeners.get(id)!.add(fn)
  return () => { listeners.get(id)?.delete(fn) }
}

export function subscribeToAllJobs(fn: JobListener): () => void {
  globalListeners.add(fn)
  return () => { globalListeners.delete(fn) }
}

const abortControllers = new Map<string, AbortController>()

export function getJobAbortController(id: string): AbortController {
  if (!abortControllers.has(id)) {
    abortControllers.set(id, new AbortController())
  }
  return abortControllers.get(id)!
}

export function cleanupJobResources(id: string): void {
  const controller = abortControllers.get(id)
  if (controller) {
    controller.abort()
    abortControllers.delete(id)
  }
}
