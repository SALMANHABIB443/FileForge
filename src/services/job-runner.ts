import {
  createJob,
  updateJobProgress,
  updateJobStatus,
  completeJob,
  failJob,
  cancelJob,
  getJob,
  getJobAbortController,
} from '@/services/job-service'
import { getTool } from '@/services/tool-registry'
import { recordJob } from '@/services/history-service'
import { recordToolUse } from '@/services/local-analytics'
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

export async function runJob(input: JobCreateInput): Promise<Job> {
  clearInterrupted()
  const job = createJob(input)
  const tool = getTool(job.toolId)

  if (!tool || !tool.engine) {
    const failed = failJob(job.id, !tool ? `Tool "${job.toolId}" is not registered` : `Tool "${job.toolId}" has no engine`)
    void recordJob(failed)
    return failed
  }

  if (running.has(job.id)) return job

  running.set(job.id, true)
  recordToolUse(job.toolId)
  const controller = getJobAbortController(job.id)

  try {
    updateJobStatus(job.id, 'processing')

    const result = await tool.engine.execute(
      job.inputs,
      job.options,
      (percent, message) => updateJobProgress(job.id, percent, message),
      controller.signal,
    )

    if (controller.signal.aborted) {
      cancelJob(job.id)
    } else {
      completeJob(job.id, job.outputName ?? result.filename, result.blob)
      const completed = getJob(job.id)!
      void recordJob(completed)
    }
  } catch (err) {
    if (controller.signal.aborted) {
      cancelJob(job.id)
    } else {
      const message = err instanceof Error ? err.message : String(err)
      const failed = failJob(job.id, message)
      void recordJob(failed)
    }
  } finally {
    running.delete(job.id)
  }

  return getJob(job.id)!
}

export function cancelRunningJob(id: string): void {
  const controller = getJobAbortController(id)
  controller.abort()
  cancelJob(id)
}