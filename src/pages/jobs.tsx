import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { QueueJobCard } from '@/components/queue-job-card'
import {
  getIncompleteJobs,
  getTerminalJobs,
  isRetryable,
  retryJob,
  deleteJobFromQueue,
} from '@/services/queue'
import { subscribeToAllJobs } from '@/services/job-service'
import { Button } from '@/components/ui/button'
import type { Job } from '@/types/job'

export default function Jobs() {
  const [active, setActive] = useState<Job[]>(() => getIncompleteJobs())
  const [terminal, setTerminal] = useState<Job[]>(() => getTerminalJobs())

  useEffect(() => {
    const refresh = () => {
      setActive(getIncompleteJobs())
      setTerminal(getTerminalJobs())
    }
    refresh()
    const unsub = subscribeToAllJobs(refresh)
    return unsub
  }, [])

  const retryableTerminal = terminal.filter((j) => isRetryable(j))

  const handleRetryFailed = () => {
    for (const job of retryableTerminal) retryJob(job.id)
  }

  const handleClearFinished = () => {
    for (const job of terminal) deleteJobFromQueue(job.id)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[36px] leading-[1.11] tracking-[-0.9px] font-bold text-ink font-[family-name:var(--font-geist)]">
            Jobs
          </h1>
          <p className="text-[16px] leading-[1.5] text-mid-gray mt-2 font-[family-name:var(--font-geist)]">
            Track, cancel, and retry your conversions
          </p>
        </div>
        <div className="flex gap-2">
          {retryableTerminal.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleRetryFailed}>
              Retry failed ({retryableTerminal.length})
            </Button>
          )}
          {terminal.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleClearFinished}>
              Clear finished
            </Button>
          )}
        </div>
      </div>

      <section aria-label="Active jobs">
        <h2 className="mb-3 text-[18px] leading-[1.33] font-bold text-ink font-[family-name:var(--font-geist)]">
          Active
        </h2>
        {active.length === 0 ? (
          <EmptyState
            icon={<BankIcon />}
            title="Nothing running"
            hint="Convert a file from any tool and it will show up here. Up to two jobs run at a time; the rest wait in line."
          />
        ) : (
          <div className="space-y-3" aria-live="polite">
            {active.map((job) => (
              <QueueJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Finished jobs">
        <h2 className="mb-3 text-[18px] leading-[1.33] font-bold text-ink font-[family-name:var(--font-geist)]">
          Finished this session
        </h2>
        {terminal.length === 0 ? (
          <EmptyState
            icon={<BankIcon />}
            title="No finished jobs"
            hint="Completed, failed, and cancelled jobs will be listed here."
          />
        ) : (
          <div className="space-y-3">
            {terminal.map((job) => (
              <QueueJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <Card className="p-8 flex flex-col items-center justify-center text-center space-y-2">
      <span className="text-mid-gray">{icon}</span>
      <p className="text-[15px] font-semibold text-ink font-[family-name:var(--font-geist)]">{title}</p>
      <p className="max-w-sm text-[12.5px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
        {hint}
      </p>
    </Card>
  )
}

function BankIcon() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
}