import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { computeRenames } from '@/engines/rename-engine'
import type { CustomPanelProps } from '@/services/tool-registry'

export function RenamePreviewPanel({ files, values }: CustomPanelProps) {
  const renames = useMemo(() => computeRenames(files, values), [files, values])

  const changedCount = renames.filter((r) => r.original !== r.renamed).length

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
          Rename Preview
        </h3>
        <Badge variant="soft">{changedCount} of {renames.length}</Badge>
      </div>

      <div className="max-h-[240px] overflow-y-auto space-y-1">
        {renames.map((r) => (
          <div
            key={r.original}
            className="flex items-center gap-2 py-1 px-1 text-[14px] leading-[1.43] font-[family-name:var(--font-geist)]"
          >
            <span className="text-mid-gray truncate flex-1 min-w-0">{r.original}</span>
            <span className="text-mid-gray shrink-0">→</span>
            <span className={`truncate flex-1 min-w-0 ${r.original !== r.renamed ? 'text-ink font-medium' : 'text-mid-gray'}`}>
              {r.renamed}
            </span>
          </div>
        ))}
      </div>

      {changedCount === 0 && (
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
          No changes with current settings. Adjust the options above.
        </p>
      )}
    </Card>
  )
}
