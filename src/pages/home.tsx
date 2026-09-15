import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilePreview } from '@/components/file-preview'
import { getAllTools } from '@/services/tool-registry'
import { pickFiles, fileMetasFromFiles } from '@/services/file-service'
import { useAppStore } from '@/store'
import { getHistoryEntries, type HistoryEntry } from '@/services/history-service'
import { formatFileSize } from '@/utils/filename'
import { useState, useEffect, useCallback, type DragEvent } from 'react'
import type { FileMeta } from '@/types/job'

const POPULAR_TOOLS = ['image-convert', 'pdf-merge', 'zip-extract', 'file-info']

const TOOL_ICONS: Record<string, { bg: string; icon: string }> = {
  'image-convert': { bg: 'bg-blue-50', icon: '🖼️' },
  'pdf-merge': { bg: 'bg-rose-50', icon: '📄' },
  'zip-extract': { bg: 'bg-purple-50', icon: '📦' },
  'file-info': { bg: 'bg-emerald-50', icon: '📋' },
}

export default function Home() {
  const navigate = useNavigate()
  const storeSelectFiles = useAppStore((s) => s.selectFiles)
  const [files, setFiles] = useState<FileMeta[]>([])
  const [recent, setRecent] = useState<HistoryEntry[]>([])
  const [recentStatus, setRecentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [dragOver, setDragOver] = useState(false)

  const loadRecent = useCallback(() => {
    let cancelled = false
    getHistoryEntries()
      .then((entries) => {
        if (cancelled) return
        setRecent(entries.slice(0, 3))
        setRecentStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setRecentStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return loadRecent()
  }, [loadRecent])

  const retryRecent = () => {
    setRecentStatus('loading')
    loadRecent()
  }

  const acceptFiles = (incoming: FileMeta[]) => {
    if (incoming.length === 0) return
    setFiles(incoming)
    storeSelectFiles(incoming)
  }

  const handlePickFiles = async () => {
    const picked = await pickFiles()
    acceptFiles(picked)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer?.files
    if (dropped && dropped.length > 0) {
      acceptFiles(fileMetasFromFiles(Array.from(dropped)))
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleToolSelect = (toolId: string) => {
    if (files.length > 0) storeSelectFiles(files)
    navigate(`/tool/${toolId}`)
  }

  const popularTools = POPULAR_TOOLS
    .map((id) => getAllTools().find((t) => t.id === id))
    .filter(Boolean) as ReturnType<typeof getAllTools>[number][]

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute right-0 top-0 flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle theme"
            className="w-11 h-11 rounded-full bg-surface-alt flex items-center justify-center hover:bg-brown-hover transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brown-dark">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Profile"
            className="w-11 h-11 rounded-full bg-surface-alt flex items-center justify-center hover:bg-brown-hover transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brown-dark">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
          </button>
        </div>
        <div className="pr-28 sm:pr-0">
          <span className="inline-flex items-center h-[32px] px-3.5 rounded-[var(--radius-buttons)] bg-surface-alt text-brown text-[13px] font-semibold font-[family-name:var(--font-geist)]">
            Hello 👋
          </span>
          <h1 className="text-[36px] leading-[1.11] tracking-[-0.9px] font-bold text-ink mt-2.5 font-[family-name:var(--font-geist)]">
            Welcome to FileForge
          </h1>
          <p className="text-[16px] leading-[1.5] text-mid-gray mt-2 font-[family-name:var(--font-geist)]">
            Privacy-first file utilities — everything runs on your device.
          </p>
        </div>
      </div>

      {/* Upload drop zone */}
      <div
        className="w-full min-w-0 rounded-[var(--radius-3xl)] border border-hairline bg-paper shadow-[var(--shadow-card)] p-3 sm:p-4"
      >
        <button
          type="button"
          onClick={handlePickFiles}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full min-w-0 flex flex-col items-center justify-center text-center min-h-[200px] sm:min-h-[240px] px-3 py-6 sm:p-8 rounded-[17px] border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? 'border-brown-dark bg-brown-hover'
              : 'border-dashed bg-transparent hover:bg-canvas'
          }`}
        >
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[16px] flex items-center justify-center mb-4 sm:mb-5 shrink-0 ${dragOver ? 'bg-brown-light' : 'bg-brown-light'}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-brown w-7 h-7 sm:w-9 sm:h-9">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              <path d="M12 10v6" />
              <path d="M9 13l3-3 3 3" />
            </svg>
          </div>
          <p className="w-full max-w-[320px] text-[16px] sm:text-[18px] leading-[1.56] font-semibold text-ink mb-2 font-[family-name:var(--font-geist)] break-words">
            Drop files here or click to select
          </p>
          <p className="w-full max-w-[320px] text-[13px] sm:text-[14px] leading-[1.43] text-mid-gray mb-5 font-[family-name:var(--font-geist)] break-words">
            Supports multiple files • No data leaves your device
          </p>
          <span className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-buttons)] px-4 sm:px-5 h-[44px] bg-brown text-paper text-[14px] font-semibold font-[family-name:var(--font-geist)] shadow-[var(--shadow-card)] shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Select Files
          </span>
        </button>
      </div>

      {/* Selected files */}
      {files.length > 0 && (
        <div className="space-y-3" aria-live="polite">
          <h2 className="text-[18px] leading-[1.56] font-semibold text-ink font-[family-name:var(--font-geist)]">
            Selected Files ({files.length})
          </h2>
          {files.map((f) => (
            <FilePreview key={f.id} file={f} onToolSelect={handleToolSelect} />
          ))}
        </div>
      )}

      {/* Popular Tools */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brown">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <h2 className="text-[22px] leading-[1.2] font-bold text-ink font-[family-name:var(--font-geist)]">
              Popular Tools
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tools')}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-mid-gray hover:text-brown-dark transition-colors cursor-pointer"
          >
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularTools.map((tool) => {
            const iconConfig = TOOL_ICONS[tool.id] || { bg: 'bg-surface-alt', icon: '🔧' }
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => navigate(`/tool/${tool.id}`)}
                className="group h-[160px] p-5 bg-paper rounded-[var(--radius-cards)] border border-hairline shadow-[var(--shadow-card)] text-left cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:border-brown-light transition-all flex flex-col relative"
              >
                <div className={`w-12 h-12 rounded-[13px] flex items-center justify-center text-[22px] ${iconConfig.bg}`}>
                  {iconConfig.icon}
                </div>
                <p className="text-[16px] leading-[1.43] font-bold text-ink mt-3 font-[family-name:var(--font-geist)]">
                  {tool.name}
                </p>
                <p className="text-[13px] leading-[1.4] text-mid-gray mt-1 line-clamp-2 font-[family-name:var(--font-geist)]">
                  {tool.description}
                </p>
                <span className="absolute bottom-5 right-5 w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center group-hover:bg-brown-light transition-colors">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brown-dark group-hover:translate-x-0.5 transition-transform">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brown">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
            <h2 className="text-[22px] leading-[1.2] font-bold text-ink font-[family-name:var(--font-geist)]">
              Recent Activity
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-mid-gray hover:text-brown-dark transition-colors cursor-pointer"
          >
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        {recentStatus === 'loading' && (
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            Loading…
          </p>
        )}
        {recentStatus === 'error' && (
          <div role="alert" className="space-y-2">
            <p className="text-[14px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]">
              Could not load your recent activity.
            </p>
            <Button variant="secondary" size="sm" onClick={retryRecent}>
              Try again
            </Button>
          </div>
        )}
        {recentStatus === 'ready' && recent.length === 0 && (
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            No recent activity yet. Your last conversions will appear here.
          </p>
        )}
        {recentStatus === 'ready' && recent.length > 0 && (
          <div className="space-y-3">
            {recent.map((entry) => (
              <div
                key={entry.id}
                className="w-full min-h-[84px] border border-hairline rounded-[var(--radius-cards)] bg-paper shadow-[var(--shadow-card)] px-5 flex items-center justify-between"
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
                      <span>{entry.toolId}</span>
                      <span className="w-1 h-1 rounded-full bg-muted inline-block" />
                      <span>{formatFileSize(entry.inputSize)}</span>
                      <span className="w-1 h-1 rounded-full bg-muted inline-block" />
                      <span>{formatDate(entry.createdAt)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge variant="success">✓ Completed</Badge>
                  <button
                    type="button"
                    aria-label="More options"
                    className="w-10 h-10 rounded-full hover:bg-brown-hover flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mid-gray">
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}