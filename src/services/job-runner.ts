import {
  createJob,
  updateJobProgress,
  updateJobStatus,
  completeJob,
  completeJobFromPath,
  failJob,
  failJobWithDetails,
  cancelJob,
  getJob,
  getJobAbortController,
  clearJobSavedPath,
} from '@/services/job-service'
import { getTool } from '@/services/tool-registry'
import { recordJob } from '@/services/history-service'
import { recordToolUse } from '@/services/local-analytics'
import { BatchError } from '@/utils/batch-error'
import type { JobCreateInput, Job } from '@/types/job'

const running = new Map<string, boolean>()
const INTERRUPT_KEY = 'fileforge:interrupted'

function markInterrupted(): void {
  try { sessionStorage.setItem(INTERRUPT_KEY, '1') } catch { /* unavailable */ }
}

function clearInterrupted(): void {
  try { sessionStorage.removeItem(INTERRUPT_KEY) } catch { /* unavailable */ }
}

export function wasInterrupted(): boolean {
  try { return sessionStorage.getItem(INTERRUPT_KEY) === '1' } catch { return false }
}

export function dismissInterrupted(): void {
  clearInterrupted()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (running.size > 0) {
      markInterrupted()
      for (const id of Array.from(running.keys())) {
        try { cancelRunningJob(id) } catch { /* already gone */ }
      }
    }
  })
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function technicalDetails(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) return err.stack
  return err instanceof Error ? err.message : String(err)
}

/**
 * Runs the engine for an already-created job (used by the queue and by
 * `runJob`). Starts from `pending`, drives progress, and finalizes the job
 * to completed / failed / cancelled. Records finished jobs into history.
 */
export async function executeJob(jobId: string): Promise<Job> {
  const job = getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found`)

  const tool = getTool(job.toolId)
  if (!tool || !tool.engine) {
    const failed = failJob(
      job.id,
      !tool ? `Tool "${job.toolId}" is not registered` : `Tool "${job.toolId}" has no engine`,
    )
    void recordJob(failed)
    return failed
  }

  if (running.has(job.id)) return job

  running.set(job.id, true)
  recordToolUse(job.toolId)
  const controller = getJobAbortController(job.id)

  try {
    updateJobStatus(job.id, 'processing')
    clearJobSavedPath(job.id)

    const result = await tool.engine.execute(
      job.inputs,
      job.options,
      (percent, message, detail) =>
        updateJobProgress(job.id, percent, message, detail?.index, detail?.total),
      controller.signal,
      { requestId: job.id },
    )

    if (controller.signal.aborted) {
      cancelJob(job.id)
    } else if (result.outputPath) {
      completeJobFromPath(job.id, job.outputName ?? result.filename, result.outputPath, result.outputSize ?? 0)
      void recordJob(getJob(job.id)!)
    } else if (result.blob) {
      completeJob(job.id, job.outputName ?? result.filename, result.blob)
      void recordJob(getJob(job.id)!)
    }
  } catch (err) {
    if (controller.signal.aborted) {
      cancelJob(job.id)
    } else if (err instanceof BatchError) {
      const failed = failJobWithDetails(job.id, err.message, {
        errorDetails: err.details ?? technicalDetails(err),
        failedFiles: err.failedFiles,
      })
      void recordJob(failed)
    } else {
      const failed = failJobWithDetails(job.id, messageOf(err), {
        errorDetails: technicalDetails(err),
      })
      void recordJob(failed)
    }
  } finally {
    running.delete(job.id)
  }

  return getJob(job.id)!
}

export async function runJob(input: JobCreateInput): Promise<Job> {
  clearInterrupted()
  const job = createJob(input)
  await executeJob(job.id)
  return getJob(job.id)!
}

export function cancelRunningJob(id: string): void {
  const controller = getJobAbortController(id)
  controller.abort()
  cancelJob(id)
}

export function currentRunningJobs(): string[] {
  return Array.from(running.keys())
}