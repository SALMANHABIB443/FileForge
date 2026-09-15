import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getHistoryEntries, deleteHistoryEntry, clearHistory, type HistoryEntry } from '@/services/history-service'
import { formatFileSize } from '@/utils/filename'

const TOOL_NAMES: Record<string, string> = {
  'image-convert': 'Image Convert',
  'image-compress': 'Image Compress',
  'image-resize': 'Image Resize',
  'images-to-pdf': 'Images to PDF',
  'pdf-merge': 'PDF Merge',
  'pdf-split': 'PDF Split',
  'pdf-compress': 'PDF Compress',
  'zip-create': 'Create ZIP',
  'zip-extract': 'Extract ZIP',
  'file-info': 'File Info',
}

type LoadStatus = 'loading' | 'ready' | 'error'

export default function History() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')

  const reload = useCallback(() => {
    getHistoryEntries()
      .then((list) => {
        setEntries(list)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    let cancelled = false
    getHistoryEntries()
      .then((list) => {
        if (cancelled) return
        setEntries(list)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteHistoryEntry(id)
      reload()
    },
    [reload],
  )

  const handleClear = useCallback(async () => {
    await clearHistory()
    reload()
  }, [reload])

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[36px] leading-[1.11] tracking-[-0.9px] font-bold text-ink font-[family-name:var(--font-geist)]">
            History
          </h1>
          <p className="text-[16px] leading-[1.5] text-mid-gray mt-2 font-[family-name:var(--font-geist)]">
            Your recent operations
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleClear}>
            Clear all
          </Button>
        )}
      </div>

      {status === 'loading' && (
        <div className="py-16 flex flex-col items-center justify-center">
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            Loading…
          </p>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="py-16 flex flex-col items-center justify-center">
          <p className="text-[14px] leading-[1.43] text-ember mb-4 font-[family-name:var(--font-geist)]">
            Could not load your history.
          </p>
          <Button variant="secondary" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {status === 'ready' && entries.length === 0 && (
        <div className="py-16 flex flex-col items-center justify-center">
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            No history yet. Complete a conversion to see it here.
          </p>
        </div>
      )}

      {status === 'ready' && entries.length > 0 && (
        <div className="space-y-3" aria-live="polite">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id
            const controlId = `history-actions-${entry.id}`
            return (
              <div key={entry.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  aria-expanded={isExpanded}
                  aria-controls={controlId}
                  className="w-full min-h-[84px] px-5 py-4 flex items-center justify-between bg-paper rounded-[var(--radius-cards)] border border-hairline shadow-[var(--shadow-card)] cursor-pointer hover:shadow-[var(--shadow-card-hover)] transition-all text-left"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-14 h-14 rounded-[13px] bg-blue-50 flex items-center justify-center shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="m9 3 0 18" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-[1.43] font-semibold text-ink truncate font-[family-name:var(--font-geist)]">
                        {entry.inputNames.join(', ')}
                      </p>
                      <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)] flex items-center gap-1.5">
                        <span>{TOOL_NAMES[entry.toolId] ?? entry.toolId}</span>
                        <span className="w-1 h-1 rounded-full bg-muted inline-block" />
                        <span>{formatFileSize(entry.inputSize)}</span>
                        {entry.outputName && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-muted inline-block" />
                            <span>→ {entry.outputName}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge variant={entry.status === 'completed' ? 'success' : 'solid'}>
                      {entry.status === 'completed' ? '✓ Completed' : entry.status}
                    </Badge>
                    <span className="text-[12px] text-mid-gray font-[family-name:var(--font-geist)] whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div id={controlId} className="flex items-center gap-2 px-5">
                    <Button variant="secondary" size="sm" onClick={() => handleDelete(entry.id)}>
                      Delete
                    </Button>
                    {entry.toolId !== 'file-info' && (
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/tool/${entry.toolId}`)}>
                        Re-run
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}