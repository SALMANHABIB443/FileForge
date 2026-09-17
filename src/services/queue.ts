import {
  createJob,
  cancelJob,
  deleteJob,
  getJob,
  getAllJobs,
  subscribeToAllJobs,
  updateJobStatus,
  failJobWithDetails,
} from '@/services/job-service'
import { executeJob } from '@/services/job-runner'
import { loadSettings } from '@/services/settings-service'
import { recordJob } from '@/services/history-service'
import {
  loadQueuedJobs,
  saveQueuedJob,
  deleteQueuedJob,
  deserializeInputs,
} from '@/services/job-persistence'
import type { Job, JobCreateInput, JobStatus } from '@/types/job'

const queueOrder: string[] = []
const running = new Set<string>()
const lastPersistedStatus = new Map<string, JobStatus>()
let ready = false

function persist(job: Job): void {
  if (job.status === 'pending' || job.status === 'processing') {
    if (lastPersistedStatus.get(job.id) === job.status) return
    lastPersistedStatus.set(job.id, job.status)
    void saveQueuedJob(job)
  } else {
    lastPersistedStatus.delete(job.id)
    void deleteQueuedJob(job.id)
  }
}

function removeFromOrder(id: string): void {
  const idx = queueOrder.indexOf(id)
  if (idx !== -1) queueOrder.splice(idx, 1)
}

function enqueueExisting(job: Job): void {
  if (!queueOrder.includes(job.id)) {
    queueOrder.push(job.id)
  }
  persist(job)
}

function pump(): void {
  if (!ready) return
  const max = Math.min(4, Math.max(1, loadSettings().maxConcurrentJobs))
  while (running.size < max) {
    const next = queueOrder.find((id) => {
      if (running.has(id)) return false
      const job = getJob(id)
      return !!job && job.status === 'pending'
    })
    if (!next) break
    running.add(next)
    const started = executeJob(next)
    started
      .catch(() => {})
      .finally(() => {
        running.delete(next)
        const job = getJob(next)
        if (job && (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
          removeFromOrder(next)
        }
        pump()
      })
  }
}

/** Adds a job to the queue and starts it when a slot is free. */
export function enqueueJob(input: JobCreateInput): Job {
  const job = createJob(input)
  enqueueExisting(job)
  pump()
  return job
}

/** Creates a brand-new job from a finished one with the same inputs + options. */
export function retryJob(jobId: string): Job | null {
  const source = getJob(jobId)
  if (!source) return null
  if (source.status !== 'failed' && source.status !== 'cancelled') return null
  if (!isRetryable(source)) return null
  return enqueueJob({
    toolId: source.toolId,
    inputs: source.inputs,
    options: source.options,
    outputName: source.outputName,
    retryCount: (source.retryCount ?? 0) + 1,
  })
}

/** Cancels a running job (aborts the engine) or removes a queued job. */
export function cancelQueuedJob(jobId: string): void {
  const job = getJob(jobId)
  if (!job) return
  if (running.has(jobId) && (job.status === 'pending' || job.status === 'processing')) {
    import('@/services/job-runner').then((m) => m.cancelRunningJob(jobId))
  } else if (job.status === 'pending') {
    cancelJob(jobId)
    removeFromOrder(jobId)
  }
  persist(job)
}

/** Removes a job from the in-memory store, queue, and persisted queue. */
export function deleteJobFromQueue(jobId: string): boolean {
  running.delete(jobId)
  removeFromOrder(jobId)
  const removed = deleteJob(jobId)
  void deleteQueuedJob(jobId)
  return removed
}

export function isJobQueued(jobId: string): boolean {
  return queueOrder.includes(jobId)
}

export function getIncompleteJobs(): Job[] {
  return queueOrder
    .map((id) => getJob(id))
    .filter((j): j is Job => !!j)
    .slice()
}

export function getTerminalJobs(): Job[] {
  return getAllJobs()
    .filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 100)
}

export function isRetryable(job: Job): boolean {
  return job.inputs.length > 0 && job.inputs.every((f) => Boolean(f.path || f.file || f.handle))
}

/** Restores persisted jobs after a restart and hooks up persistence. */
export async function initQueue(): Promise<void> {
  if (ready) return
  ready = true

  subscribeToAllJobs(persist)

  const restored = await loadQueuedJobs()
  const settings = loadSettings()
  const canResume = settings.resumePendingJobs

  for (const entry of restored) {
    const inputs = deserializeInputs(entry.inputs)
    const hasPaths = inputs.every((f) => Boolean(f.path))

    if (entry.status === 'pending' && canResume && hasPaths) {
      const job = createJob({
        id: entry.id,
        toolId: entry.toolId,
        inputs,
        options: entry.options,
        outputName: entry.outputName,
        createdAt: entry.createdAt,
      })
      enqueueExisting(job)
    } else if (entry.status === 'processing' || (entry.status === 'pending' && !hasPaths)) {
      const job = createJob({
        id: entry.id,
        toolId: entry.toolId,
        inputs,
        options: entry.options,
        outputName: entry.outputName,
        createdAt: entry.createdAt,
        interrupted: true,
      })
      updateJobStatus(job.id, 'processing')
      const failed = failJobWithDetails(
        job.id,
        'FileForge closed while this job was still running, so it could not finish. You can retry it.',
        { interrupted: true },
      )
      void recordJob(failed)
    } else {
      // resume disabled — cancel the pending job
      const job = createJob({
        id: entry.id,
        toolId: entry.toolId,
        inputs,
        options: entry.options,
        outputName: entry.outputName,
        createdAt: entry.createdAt,
        interrupted: true,
      })
      cancelJob(job.id)
    }
  }

  void pump()
}

export function subscribeQueueRuntime(fn: (job: Job) => void): () => void {
  return subscribeToAllJobs(fn)
}