import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToAllJobs } from '@/services/job-service'
import { getTool } from '@/services/tool-registry'
import type { Job } from '@/types/job'

export function GlobalJobIndicator() {
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsub = subscribeToAllJobs((job) => {
      if (job.status === 'processing' || job.status === 'pending') {
        setDismissed(false)
        setActiveJob(job)
      } else if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        setActiveJob((current) => (current?.id === job.id ? null : current))
      }
    })
    return unsub
  }, [])

  if (!activeJob || dismissed) return null

  const tool = getTool(activeJob.toolId)
  const isActive = activeJob.status === 'processing'
  const percent = Math.max(0, Math.min(100, activeJob.progress.percent))

  return (
    <div className="fixed right-4 bottom-20 z-40 w-[calc(100%-2rem)] max-w-sm md:bottom-6">
      <div
        role="status"
        aria-live="polite"
        className="rounded-[var(--radius-cards)] border border-hairline bg-paper p-4 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
            {isActive ? `${tool?.name ?? 'Processing'}…` : `${tool?.name ?? 'Job'} queued`}
          </p>
          <Link
            to="/history"
            className="shrink-0 text-[12px] font-medium text-mid-gray hover:text-brown-dark"
          >
            View
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss job indicator"
            className="shrink-0 text-[12px] text-mid-gray hover:text-brown-dark"
          >
            Dismiss
          </button>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label={`${tool?.name ?? 'Job'} progress`}
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas"
        >
          <div
            className="h-full rounded-full bg-brown transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-mid-gray">
          {Math.round(percent)}%
          {activeJob.progress.message ? ` · ${activeJob.progress.message}` : ''}
        </p>
      </div>
    </div>
  )
}