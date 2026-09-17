import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getTool } from '@/services/tool-registry'
import { cancelQueuedJob, retryJob, deleteJobFromQueue, isRetryable } from '@/services/queue'
import { setJobSavedPath } from '@/services/job-service'
import { loadSettings } from '@/services/settings-service'
import { downloadBlob } from '@/utils/permission-helpers'
import { formatFileSize } from '@/utils/filename'
import { SavedFileActions } from '@/components/saved-file-actions'
import type { Job } from '@/types/job'

interface QueueJobCardProps {
  job: Job
}

export function QueueJobCard({ job }: QueueJobCardProps) {
  const tool = useMemo(() => getTool(job.toolId), [job.toolId])
  const isActive = job.status === 'pending' || job.status === 'processing'
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const percent = Math.max(0, Math.min(100, job.progress.percent))
  const { index, total } = job.progress
  const inputTotal = job.inputs.reduce((sum, f) => sum + f.size, 0)
  const printable = isRetryable(job)

  const handleCancel = () => cancelQueuedJob(job.id)

  const handleRetry = () => {
    retryJob(job.id)
  }

  const handleDelete = () => deleteJobFromQueue(job.id)

  const handleSave = async () => {
    if (!job.outputBlob && !job.outputPath) return
    const fileforge = typeof window !== 'undefined' ? window.fileforge : undefined
    if (fileforge) {
      const settings = loadSettings()
      const defaultDir = settings.defaultOutputDir || undefined
      if (job.outputPath) {
        const saved = await fileforge.saveAsFile({
          sourcePath: job.outputPath,
          suggestedName: job.outputName ?? 'output',
          defaultDir,
        })
        if (saved) {
          setJobSavedPath(job.id, saved)
          void fileforge.cleanupJobTemp(job.id)
        }
      } else if (job.outputBlob) {
        const data = await job.outputBlob.arrayBuffer()
        const saved = await fileforge.saveAsOutput({
          data,
          suggestedName: job.outputName ?? 'output',
          defaultDir,
        })
        if (saved) setJobSavedPath(job.id, saved)
      }
    } else if (job.outputBlob) {
      downloadBlob(job.outputBlob, job.outputName ?? 'output')
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-[1.43] font-semibold text-ink truncate font-[family-name:var(--font-geist)]">
            {job.inputs.map((f) => f.name).join(', ')}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
            {tool?.name ?? job.toolId}
            {job.retryCount ? ` · attempt ${job.retryCount}` : ''}
          </p>
        </div>
        <StatusBadge job={job} />
      </div>

      {isActive && (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-label={`${tool?.name ?? 'Job'} progress`}
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-canvas"
          >
            <div
              className="h-full rounded-full bg-brown transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
            {total !== undefined && total > 1 ? `File ${index ?? 1} of ${total} · ` : ''}
            {job.progress.message ?? `${Math.round(percent)}%`}
          </p>
        </>
      )}

      {isComplete && inputTotal > 0 && outputSize(job) > 0 && (
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
          {formatFileSize(inputTotal)} → {formatFileSize(outputSize(job))} · {job.outputName}
        </p>
      )}

      {isComplete && job.savedPath && (
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)] break-all">
          Saved to {job.savedPath}
        </p>
      )}

      {isComplete && job.savedPath && <SavedFileActions path={job.savedPath} />}

      {isFailed && (
        <div className="space-y-2">
          <p
            role="alert"
            className="text-[12px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]"
          >
            {job.error ?? 'Something went wrong'}
          </p>
          <ErrorDetails job={job} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {isActive && (
          <Button variant="destructive" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        )}
        {isComplete && (
          <Button variant="primary" size="sm" onClick={() => void handleSave()}>
            Save
          </Button>
        )}
        {(isFailed || (!isActive && !isComplete)) && printable && (
          <Button variant="primary" size="sm" onClick={handleRetry}>
            Retry
          </Button>
        )}
        {(isComplete || isFailed) && (
          <Button variant="secondary" size="sm" onClick={handleDelete}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  )
}

function StatusBadge({ job }: { job: Job }) {
  const map = {
    pending: 'solid',
    processing: 'solid',
    completed: 'success',
    failed: 'solid',
    cancelled: 'solid',
  } as const
  const labels = {
    pending: 'Queued',
    processing: 'Processing',
    completed: '✓ Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  } as const
  return <Badge variant={map[job.status]}>{labels[job.status]}</Badge>
}

function outputSize(job: Job): number {
  return job.outputBlob?.size ?? job.outputSize ?? 0
}

function ErrorDetails({ job }: { job: Job }) {
  const showTechnical = job.errorDetails && job.errorDetails !== job.error
  const hasFiles = job.failedFiles && job.failedFiles.length > 0
  if (!showTechnical && !hasFiles) return null

  return (
    <details className="group rounded-[12px] border border-hairline bg-canvas p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-mid-gray hover:text-ink font-[family-name:var(--font-geist)]">
        <svg
          aria-hidden="true"
          className="transition-transform group-open:rotate-90"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        {hasFiles ? 'Affected files & details' : 'Technical details'}
      </summary>
      <div className="mt-2 space-y-2">
        {hasFiles && (
          <ul className="space-y-1">
            {job.failedFiles!.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5 text-[12px] leading-[1.4]"
              >
                <span className="block font-medium text-ink">{f.name}</span>
                <span className="block text-mid-gray">{f.error}</span>
              </li>
            ))}
          </ul>
        )}
        {showTechnical && (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-[1.5] text-mid-gray font-mono">
            {job.errorDetails}
          </pre>
        )}
      </div>
    </details>
  )
}