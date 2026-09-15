import { useEffect, useRef, useState } from 'react'
import { ReorderList } from '@/components/reorder-list'
import type { CustomPanelProps } from '@/services/tool-registry'
import { readFileAsBlob } from '@/services/file-service'

export function PdfPagesPanel({ files, values, onChange }: CustomPanelProps) {
  const file = files[0]
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const initializedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!file || initializedRef.current === file.id) return
    initializedRef.current = file.id
    let cancelled = false
    setError(null)
    void readFileAsBlob(file)
      .then(async (blob) => {
        const { PDFDocument } = await import('pdf-lib')
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
        if (cancelled) return
        const count = doc.getPageCount()
        setPageCount(count)
        const order = values.order
        if (!order || !Array.isArray(order) || (order as number[]).length !== count) {
          onChange({ ...values, order: Array.from({ length: count }, (_, i) => i) })
        }
      })
      .catch(() => {
        if (cancelled) return
        setPageCount(0)
        setError('Could not read this PDF. Encrypted or corrupt files cannot be reordered.')
      })
    return () => {
      cancelled = true
    }
  }, [file, values, onChange])

  if (!file) return null

  if (error) {
    return <p role="alert" className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">{error}</p>
  }

  if (pageCount === 0) return null

  const items = Array.from({ length: pageCount }, (_, i) => ({
    key: String(i),
    title: `Page ${i + 1}`,
    subtitle: `Page ${i + 1} of ${pageCount}`,
  }))

  const ordered: typeof items = Array.isArray(values.order)
    ? (values.order as number[])
        .map((idx) => items[idx])
        .filter((item): item is (typeof items)[number] => item !== undefined)
    : items

  return (
    <ReorderList
      items={ordered}
      onReorder={(newItems) => {
        const order = newItems.map((i) => Number(i.key))
        onChange({ ...values, order })
      }}
    />
  )
}