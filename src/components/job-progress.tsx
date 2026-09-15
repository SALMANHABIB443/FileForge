import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatSizeComparison } from '@/utils/filename'
import type { Job } from '@/types/job'

interface JobProgressProps {
  job: Job
  onCancel?: () => void
  onDownload?: () => void
  onConvertAnother?: () => void
  error?: string
}

export function JobProgress({ job, onCancel, onDownload, onConvertAnother, error }: JobProgressProps) {
  const isProcessing = job.status === 'processing' || job.status === 'pending'
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isCancelled = job.status === 'cancelled'

  const inputTotal = job.inputs.reduce((sum, f) => sum + f.size, 0)
  const outputSize = job.outputBlob?.size ?? 0

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
        aria-label="Conversion progress"
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

      {job.progress.message && (
        <p
          role="status"
          aria-live="polite"
          className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]"
        >
          {job.progress.message}
        </p>
      )}

      {isFailed && (
        <p
          role="alert"
          className="text-[14px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]"
        >
          {error ?? job.error ?? 'Something went wrong'}
        </p>
      )}

      {isComplete && outputSize > 0 && inputTotal > 0 && (
        <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          {formatSizeComparison(inputTotal, outputSize)}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {isProcessing && onCancel && (
          <Button variant="destructive" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {isComplete && onDownload && (
          <Button variant="primary" size="sm" onClick={onDownload}>
            Save
          </Button>
        )}
        {(isComplete || isFailed || isCancelled) && onConvertAnother && (
          <Button variant="secondary" size="sm" onClick={onConvertAnother}>
            Convert another
          </Button>
        )}
      </div>
    </Card>
  )
}