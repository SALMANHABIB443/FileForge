import { Card } from '@/components/ui/card'
import { getMediaFileWarnings } from '@/utils/media'
import type { FileMeta } from '@/types/job'

function isMedia(file: FileMeta): boolean {
  return file.type.startsWith('video/') || file.type.startsWith('audio/')
}

export function MediaWarning({ files }: { files: FileMeta[] }) {
  const warnings = new Set(
    files
      .filter(isMedia)
      .map((f) => getMediaFileWarnings(f.size))
      .filter((w): w is string => w !== null),
  )

  if (warnings.size === 0) return null

  return (
    <Card className="p-4 bg-canvas">
      <p role="alert" className="text-[13px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
        {Array.from(warnings).join(' ')}
      </p>
    </Card>
  )
}