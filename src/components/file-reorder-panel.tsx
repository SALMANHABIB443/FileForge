import { ReorderList } from '@/components/reorder-list'
import type { CustomPanelProps } from '@/services/tool-registry'
import type { FileMeta } from '@/types/job'
import { formatFileSize, getFileExtension } from '@/utils/filename'

export function FileReorderPanel({ files, onReorderFiles }: CustomPanelProps) {
  if (files.length <= 1) return null

  const items = files.map((f) => ({
    key: f.id,
    title: f.name,
    subtitle: `${formatFileSize(f.size)} · ${getFileExtension(f.name).toUpperCase()}`,
  }))

  return (
    <ReorderList
      items={items}
      onReorder={(newItems) => {
        if (!onReorderFiles) return
        const map = new Map<string, FileMeta>(files.map((f) => [f.id, f]))
        onReorderFiles(newItems.map((i) => map.get(i.key)!).filter(Boolean))
      }}
    />
  )
}