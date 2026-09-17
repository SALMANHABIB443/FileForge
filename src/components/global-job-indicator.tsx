import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIncompleteJobs } from '@/services/queue'
import { subscribeToAllJobs } from '@/services/job-service'
import { getTool } from '@/services/tool-registry'
import type { Job } from '@/types/job'

export function GlobalJobIndicator() {
  const [active, setActive] = useState<Job[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const refresh = () => setActive(getIncompleteJobs())

    const handler = () => {
      refresh()
      if (getIncompleteJobs().some((j) => j.status === 'pending')) setDismissed(false)
    }

    refresh()
    const unsub = subscribeToAllJobs(handler)
    return unsub
  }, [])

  if (active.length === 0 || dismissed) return null

  const running = active.filter((j) => j.status === 'processing')
  const queued = active.filter((j) => j.status === 'pending')
  const focus = running[0] ?? queued[0]
  if (!focus) return null
  const tool = getTool(focus.toolId)
  const percent = Math.max(0, Math.min(100, focus.progress.percent))
  const { index, total } = focus.progress

  return (
    <div className="fixed right-4 bottom-20 z-40 w-[calc(100%-2rem)] max-w-sm md:bottom-6">
      <div
        role="status"
        aria-live="polite"
        className="rounded-[var(--radius-cards)] border border-hairline bg-paper p-4 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
            {running.length > 0 ? `${tool?.name ?? 'Processing'}…` : `${tool?.name ?? 'Job'} queued`}
          </p>
          {running.length + queued.length > 1 && (
            <span className="shrink-0 rounded-full bg-brown-light px-2 py-0.5 text-[11px] font-semibold text-brown-dark">
              {running.length + queued.length} active
            </span>
          )}
          <Link
            to="/jobs"
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
        {running.length > 0 ? (
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
        ) : (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
            <div className="h-full w-full animate-pulse rounded-full bg-brown/50" />
          </div>
        )}
        <p className="mt-2 text-[12px] text-mid-gray">
          {total !== undefined && total > 1 ? `File ${index ?? 1} of ${total} · ` : ''}
          {focus.progress.message ?? `${Math.round(percent)}%`}
        </p>
      </div>
    </div>
  )
}