import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { wasInterrupted, dismissInterrupted } from '@/services/job-runner'

export function InterruptedBanner() {
  const [visible, setVisible] = useState<boolean>(() => wasInterrupted())

  if (!visible) return null

  return (
    <Card className="p-4 border border-ember/30">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          A previous conversion was interrupted and did not finish. Nothing was saved.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            dismissInterrupted()
            setVisible(false)
          }}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  )
}