import type { FileMeta } from '@/types/job'

let tempCounter = 0

function generateTempId(): string {
  tempCounter++
  return `temp_${Date.now()}_${tempCounter}`
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.fileforge !== 'undefined'
}

export async function pickFile(): Promise<FileMeta | null> {
  const files = await pickFiles()
  return files[0] ?? null
}

export async function pickFiles(): Promise<FileMeta[]> {
  if (isDesktop()) {
    return pickFilesDesktop()
  }
  if (typeof window === 'undefined' || !window.showOpenFilePicker) {
    return pickFilesFallback()
  }

  try {
    const handles = await window.showOpenFilePicker({ multiple: true })
    const files = await Promise.all(
      handles.map(async (handle) => {
        const file = await handle.getFile()
        return {
          id: generateTempId(),
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          handle,
        }
      }),
    )
    return files
  } catch {
    return []
  }
}

async function pickFilesDesktop(): Promise<FileMeta[]> {
  const picked = await window.fileforge!.selectFiles()
  return picked.map((info) => ({
    id: generateTempId(),
    name: info.name,
    size: info.size,
    type: getMimeType(info.name),
    lastModified: info.lastModified,
    path: info.path,
  }))
}

function pickFilesFallback(): Promise<FileMeta[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      resolve(
        files.map((file) => ({
          id: generateTempId(),
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          file,
        })),
      )
    }
    input.click()
  })
}

export function fileMetasFromFiles(files: File[]): FileMeta[] {
  return files.map((file) => ({
    id: generateTempId(),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    file,
  }))
}

/**
 * Builds FileMetas from dropped files. On the desktop app the dropped `File`
 * objects are resolved to their real on-disk path via
 * `webUtils.getPathForFile`, which the engines then read through IPC. In the
 * browser the previous File-object behavior is preserved.
 */
export function fileMetasFromDrop(files: File[]): FileMeta[] {
  const api = typeof window !== 'undefined' ? window.fileforge : undefined
  if (api) {
    return files.map((file) => ({
      id: generateTempId(),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      path: api.getPathForFile(file),
    }))
  }
  return fileMetasFromFiles(files)
}

export async function readFileAsArrayBuffer(
  fileMeta: FileMeta,
): Promise<ArrayBuffer> {
  if (fileMeta.path && isDesktop()) {
    return window.fileforge!.readFile(fileMeta.path)
  }
  const blob = await readFileAsBlob(fileMeta)
  return blob.arrayBuffer()
}

export async function readFileAsBlob(fileMeta: FileMeta): Promise<Blob> {
  if (fileMeta.path && isDesktop()) {
    const data = await window.fileforge!.readFile(fileMeta.path)
    return new Blob([data])
  }
  if (fileMeta.handle) {
    return fileMeta.handle.getFile()
  }
  if (fileMeta.file) {
    return fileMeta.file
  }
  throw new Error('No file handle available — use pickFile with File System Access API')
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

export function getMimeType(filename: string): string {
  const ext = getExtension(filename)
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    zip: 'application/zip',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  }
  return map[ext] || 'application/octet-stream'
}

export async function chooseDirectory(): Promise<{ path: string; name: string } | null> {
  if (!isDesktop()) return null
  return window.fileforge!.selectFolder()
}

export async function writeExtractionEntry(root: string, entryPath: string, data: Uint8Array): Promise<void> {
  if (!isDesktop()) throw new Error('Extraction to folders is only available in the desktop app')
  await window.fileforge!.extractWrite({ root, entryPath, data })
}

export interface OpenActionResult {
  ok: boolean
  error?: string
}

/**
 * Opens a saved file in its default application (desktop only).
 */
export async function openPath(filePath: string): Promise<OpenActionResult> {
  if (!isDesktop()) return { ok: false, error: 'Only available in the desktop app' }
  return window.fileforge!.openFile(filePath)
}

/**
 * Reveals a saved file in its folder via the OS (desktop only).
 */
export async function showInFolder(filePath: string): Promise<void> {
  if (!isDesktop()) return
  await window.fileforge!.showItemInFolder(filePath)
}

/**
 * Copies a full path to the clipboard. Returns whether the copy succeeded.
 */
export async function copyPath(filePath: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(filePath)
    return true
  } catch {
    return false
  }
}

export function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx <= 0 ? '/' : p.slice(0, idx)
}