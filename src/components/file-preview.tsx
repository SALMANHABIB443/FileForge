import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { FileMeta } from '@/types/job'
import { getSupportedToolsForFile, type ToolDefinition } from '@/services/tool-registry'
import { formatFileSize, getFileExtension } from '@/utils/filename'

function FileTypeIcon({ type }: { type: string }) {
  const cat = type.split('/')[0] ?? 'default'
  const icon =
    cat === 'image'
      ? 'M3 2h7.586l1.414 1.414h7.586A2 2 0 0 1 21 5.414v10.172a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V2zm4 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 8.414L8.5 13.5 11 16l3.5-3.5 4 4z'
      : cat === 'text'
        ? 'M6 2h9.5L20 6.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8.5 0v4.5H19zM9 13h6M9 17h4M9 9h2'
        : cat === 'application'
          ? 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5'
          : 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-mid-gray"
    >
      <path d={icon} />
    </svg>
  )
}

interface FilePreviewProps {
  file: FileMeta
  compatibleTools?: ToolDefinition[]
  onToolSelect?: (toolId: string) => void
  showTools?: boolean
}

export function FilePreview({ file, compatibleTools, onToolSelect, showTools = true }: FilePreviewProps) {
  const ext = getFileExtension(file.name) || 'file'
  const tools = compatibleTools ?? getSupportedToolsForFile(file.type)

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex-shrink-0 mt-[2px]"><FileTypeIcon type={file.type} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] leading-[1.43] text-ink truncate font-medium font-[family-name:var(--font-geist)]">
            {file.name}
          </p>
          <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
            {formatFileSize(file.size)} · {ext.toUpperCase()}
          </p>
        </div>
        <Badge variant="soft">{ext.toUpperCase()}</Badge>
      </div>

      {showTools && tools.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onToolSelect?.(tool.id)}
              className="inline-flex items-center min-h-[44px] rounded-[var(--radius-buttons)] px-3 py-1 text-[12px] font-medium font-[family-name:var(--font-geist)] bg-paper border border-hairline text-ink hover:bg-brown-hover hover:text-brown-dark transition-colors cursor-pointer"
            >
              {tool.name}
            </button>
          ))}
        </div>
      )}

      {showTools && tools.length === 0 && (
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
          No tools available for this file type.
        </p>
      )}
    </Card>
  )
}