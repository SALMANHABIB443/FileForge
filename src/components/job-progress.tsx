import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SavedFileActions } from '@/components/saved-file-actions'
import { formatSizeComparison } from '@/utils/filename'
import type { Job } from '@/types/job'

interface JobProgressProps {
  job: Job
  onCancel?: () => void
  onRetry?: () => void
  onDownload?: () => void
  onConvertAnother?: () => void
  error?: string
  savedPath?: string | null
}

export function JobProgress({
  job,
  onCancel,
  onRetry,
  onDownload,
  onConvertAnother,
  error,
  savedPath,
}: JobProgressProps) {
  const isProcessing = job.status === 'processing' || job.status === 'pending'
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isCancelled = job.status === 'cancelled'

  const inputTotal = job.inputs.reduce((sum, f) => sum + f.size, 0)
  const outputSize = job.outputBlob?.size ?? job.outputSize ?? 0
  const { index, total } = job.progress
  const finalPath = job.savedPath ?? savedPath ?? null

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
          {isProcessing ? 'Processing…' : isComplete ? 'Done' : isFailed ? 'Failed' : 'Cancelled'}
        </h3>
        <span
          role="status"
          aria-live="polite"
          className={`text-[12px] leading-[1.33] font-medium font-[family-name:var(--font-geist)] ${
            isComplete ? 'text-success-text' : isFailed ? 'text-ember' : 'text-mid-gray'
          }`}
        >
          {isComplete ? '100%' : `${job.progress.percent}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(isComplete ? 100 : job.progress.percent)}
        aria-label="Job progress"
        className="relative h-2 bg-canvas rounded-full overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${isComplete ? 100 : job.progress.percent}%`,
            backgroundColor: isFailed || isCancelled ? 'var(--color-ember)' : 'var(--color-brown)',
          }}
        />
      </div>

      {(job.progress.message || (total !== undefined && total > 1)) && (
        <p
          role="status"
          aria-live="polite"
          className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]"
        >
          {total !== undefined && total > 1 ? `File ${index ?? 1} of ${total} · ` : ''}
          {job.progress.message}
        </p>
      )}

      {isFailed && (
        <div className="space-y-3">
          <p
            role="alert"
            className="text-[14px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]"
          >
            {error ?? job.error ?? 'Something went wrong'}
          </p>
          <ErrorDetails job={job} />
        </div>
      )}

      {isComplete && outputSize > 0 && inputTotal > 0 && (
        <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          {formatSizeComparison(inputTotal, outputSize)}
        </p>
      )}

      {isComplete && finalPath && (
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)] break-all">
          Saved to {finalPath}
        </p>
      )}

      {isComplete && finalPath && <SavedFileActions path={finalPath} />}

      <div className="flex flex-wrap gap-2 pt-1">
        {isProcessing && onCancel && (
          <Button variant="destructive" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {isComplete && onDownload && (
          <Button variant="primary" size="sm" onClick={onDownload}>
            {finalPath ? 'Save As…' : 'Save'}
          </Button>
        )}
        {isFailed && onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        {isComplete && onConvertAnother && (
          <Button variant="secondary" size="sm" onClick={onConvertAnother}>
            Convert another
          </Button>
        )}
        {isFailed && onConvertAnother && (
          <Button variant="secondary" size="sm" onClick={onConvertAnother}>
            Try another file
          </Button>
        )}
        {isCancelled && onConvertAnother && (
          <Button variant="secondary" size="sm" onClick={onConvertAnother}>
            Convert another
          </Button>
        )}
      </div>
    </Card>
  )
}

function ErrorDetails({ job }: { job: Job }) {
  const showTechnical = job.errorDetails && job.errorDetails !== job.error
  const hasFiles = job.failedFiles && job.failedFiles.length > 0
  if (!showTechnical && !hasFiles) return null

  return (
    <details className="group rounded-[12px] border border-hairline bg-canvas p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-mid-gray hover:text-ink font-[family-name:var(--font-geist)]">
        <svg
          aria-hidden="true"
          className="transition-transform group-open:rotate-90"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        {hasFiles ? 'Error details & affected files' : 'Technical details'}
      </summary>
      <div className="mt-3 space-y-3">
        {hasFiles && (
          <ul className="space-y-1.5">
            {job.failedFiles!.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="rounded-[10px] border border-hairline bg-paper px-3 py-2 text-[12px] leading-[1.4]"
              >
                <span className="block font-medium text-ink font-[family-name:var(--font-geist)]">
                  {f.name}
                </span>
                <span className="block text-mid-gray font-[family-name:var(--font-geist)]">
                  {f.error}
                </span>
              </li>
            ))}
          </ul>
        )}
        {showTechnical && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-[1.5] text-mid-gray font-mono font-[family-name:var(--font-geist)]">
            {job.errorDetails}
          </pre>
        )}
      </div>
    </details>
  )
}