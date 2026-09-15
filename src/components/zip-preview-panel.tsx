import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listZipContents, type ZipEntryInfo, hasUnsafePath } from '@/engines/zip-engine'
import { nestingDepth } from '@/engines/zip-engine'
import { formatFileSize } from '@/utils/filename'
import type { CustomPanelProps } from '@/services/tool-registry'

const MAX_ENTRIES = 2000
const MAX_NESTING_DEPTH = 32

export function ZipPreviewPanel({ files, values, onChange }: CustomPanelProps) {
  const [entries, setEntries] = useState<ZipEntryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const file = files[0]

  useEffect(() => {
    if (!file) return
    let cancelled = false

    const readPromise = file.file
      ? Promise.resolve(file.file)
      : file.handle
        ? file.handle.getFile()
        : Promise.reject(new Error('Cannot read file'))

    readPromise.then((b: File) => {
      return listZipContents(b)
    }).then((result) => {
      if (cancelled) return
      setEntries(result)
      setLoading(false)
    }).catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to read ZIP')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [file])

  const safeEntries = useMemo(
    () => entries.filter((e) => !e.dir && !hasUnsafePath(e.name) && nestingDepth(e.name) <= MAX_NESTING_DEPTH),
    [entries],
  )

  const selectedEntries = (values.selectedEntries as string[] | undefined) ?? safeEntries.map((e) => e.name)
  const totalSelectedSize = useMemo(
    () => safeEntries.filter((e) => selectedEntries.includes(e.name)).reduce((sum, e) => sum + e.uncompressedSize, 0),
    [safeEntries, selectedEntries],
  )

  const toggleAll = () => {
    if (selectedEntries.length === safeEntries.length) {
      onChange({ ...values, selectedEntries: [] })
    } else {
      onChange({ ...values, selectedEntries: safeEntries.map((e) => e.name) })
    }
  }

  const toggleEntry = (name: string) => {
    const next = selectedEntries.includes(name)
      ? selectedEntries.filter((n) => n !== name)
      : [...selectedEntries, name]
    onChange({ ...values, selectedEntries: next })
  }

  if (loading) {
    return (
      <Card className="p-4">
        <p role="status" aria-live="polite" className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          Reading ZIP contents…
        </p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <p role="alert" className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          {error}
        </p>
      </Card>
    )
  }

  const dirCount = entries.filter((e) => e.dir).length
  const skippedCount = entries.length - safeEntries.length - dirCount

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
          ZIP Contents
        </h3>
        <Badge variant="soft">{entries.length} entries</Badge>
      </div>

      <div className="flex flex-wrap gap-3 text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
        <span>{safeEntries.length} files</span>
        {dirCount > 0 && <span>{dirCount} folders</span>}
        {skippedCount > 0 && <span className="text-ember">{skippedCount} skipped</span>}
        <span>{formatFileSize(totalSelectedSize)} selected</span>
      </div>

      {entries.length > MAX_ENTRIES && (
        <p className="text-[12px] leading-[1.33] text-ember font-[family-name:var(--font-geist)]">
          ZIP has {entries.length} entries — exceeds safety limit of {MAX_ENTRIES}
        </p>
      )}

      <div className="space-y-1">
        <label className="flex items-center gap-2 py-1 text-[14px] leading-[1.43] font-medium text-ink font-[family-name:var(--font-geist)] cursor-pointer">
          <input
            type="checkbox"
            checked={selectedEntries.length === safeEntries.length && safeEntries.length > 0}
            onChange={toggleAll}
            className="accent-ink"
          />
          Select all ({safeEntries.length})
        </label>

        <div className="max-h-[240px] overflow-y-auto space-y-0.5">
          {safeEntries.map((entry) => {
            const depth = (entry.name.split('/').length - 1)
            const displayName = entry.name.split('/').filter(Boolean).pop() ?? entry.name
            return (
              <label
                key={entry.name}
                className="flex items-center gap-2 py-0.5 text-[14px] leading-[1.43] font-[family-name:var(--font-geist)] cursor-pointer hover:bg-canvas rounded-[12px] px-1"
                style={{ paddingLeft: `${depth * 16 + 4}px` }}
              >
                <input
                  type="checkbox"
                  checked={selectedEntries.includes(entry.name)}
                  onChange={() => toggleEntry(entry.name)}
                  className="accent-ink"
                />
                <span className="text-ink truncate flex-1">{displayName}</span>
                <span className="text-mid-gray text-[12px] whitespace-nowrap">
                  {formatFileSize(entry.uncompressedSize)}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {safeEntries.length === 0 && (
        <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          No safe files found in this archive.
        </p>
      )}
    </Card>
  )
}
