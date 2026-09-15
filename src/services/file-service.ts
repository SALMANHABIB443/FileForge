import type { FileMeta } from '@/types/job'

let tempCounter = 0

function generateTempId(): string {
  tempCounter++
  return `temp_${Date.now()}_${tempCounter}`
}

export async function pickFile(): Promise<FileMeta | null> {
  const files = await pickFiles()
  return files[0] ?? null
}

export async function pickFiles(): Promise<FileMeta[]> {
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

export async function readFileAsArrayBuffer(
  fileMeta: FileMeta,
): Promise<ArrayBuffer> {
  const blob = await readFileAsBlob(fileMeta)
  return blob.arrayBuffer()
}

export async function readFileAsBlob(fileMeta: FileMeta): Promise<Blob> {
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
