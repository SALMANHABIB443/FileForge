import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyPath, isDesktop, openPath, showInFolder } from '@/services/file-service'

interface SavedFileActionsProps {
  path: string
}

/**
 * Desktop-only action row for a saved result: open the file, reveal it in its
 * folder, or copy its path. Renders nothing in the browser build.
 */
export function SavedFileActions({ path }: SavedFileActionsProps) {
  const [copied, setCopied] = useState(false)

  if (!isDesktop()) return null

  const handleOpen = () => void openPath(path)
  const handleFolder = () => void showInFolder(path)
  const handleCopy = async () => {
    const ok = await copyPath(path)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        Open file
      </Button>
      <Button variant="secondary" size="sm" onClick={handleFolder}>
        Open folder
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
        {copied ? 'Copied!' : 'Copy path'}
      </Button>
    </div>
  )
}