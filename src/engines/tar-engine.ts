import type { ConversionResult } from '@/types/engine'
import type { FileMeta, JobProgressDetail } from '@/types/job'
import { readFileAsBlob, writeExtractionEntry } from '@/services/file-service'
import { generateOutputName, sanitizeFilename } from '@/utils/filename'
import { checkAbort } from '@/utils/abort'

const MAX_ENTRIES = 2000
const MAX_TOTAL_UNCOMPRESSED = 4 * 1024 * 1024 * 1024
const MAX_NESTING_DEPTH = 32
const HEADER_SIZE = 512

function hasUnsafePath(path: string): boolean {
  if (path.includes('\\')) return true
  if (path.includes('..')) return true
  if (/^[a-z]:/i.test(path)) return true
  if (/^~/.test(path)) return true
  if (path.startsWith('/')) return true
  const sanitized = sanitizeFilename(path.split('/').join('_'))
  return sanitized === ''
}

function nestingDepth(path: string): number {
  return path.split('/').filter(Boolean).length
}

function parseOctal(bytes: Uint8Array, offset: number, length: number): number {
  let str = ''
  for (let i = offset; i < offset + length; i++) {
    if (bytes[i] === 0) break
    str += String.fromCharCode(bytes[i]!)
  }
  return parseInt(str.trim(), 8) || 0
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  let str = ''
  for (let i = offset; i < offset + length; i++) {
    if (bytes[i] === 0) break
    str += String.fromCharCode(bytes[i]!)
  }
  return str
}

function computeChecksum(header: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < HEADER_SIZE; i++) {
    if (i >= 148 && i < 156) {
      sum += 32
    } else {
      sum += header[i]!
    }
  }
  return sum
}

export interface TarEntry {
  name: string
  size: number
  type: string
}

export async function listTarContents(file: File): Promise<TarEntry[]> {
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)
  const entries: TarEntry[] = []
  let offset = 0

  while (offset + HEADER_SIZE <= data.length) {
    const header = data.subarray(offset, offset + HEADER_SIZE)

    const name = readString(header, 0, 100)
    if (name === '') break

    const size = parseOctal(header, 124, 12)
    const typeFlag = String.fromCharCode(header[156]!)
    const storedChecksum = parseOctal(header, 148, 8)
    const actualChecksum = computeChecksum(header)

    if (storedChecksum !== actualChecksum) {
      break
    }

    entries.push({
      name,
      size,
      type: typeFlag === '5' ? 'directory' : typeFlag === '\0' || typeFlag === '0' ? 'file' : 'other',
    })

    offset += HEADER_SIZE + Math.ceil(size / HEADER_SIZE) * HEADER_SIZE
  }

  return entries
}

export async function extractTar(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = inputs[0]!
  const ext = getFileExtensionSafe(file.name)
  if (ext !== 'tar') {
    throw new Error('Select a TAR file to extract')
  }

  onProgress?.(10, 'Reading TAR…')
  const blob = await readFileAsBlob(file)
  checkAbort(signal!)
  const buffer = await blob.arrayBuffer()
  const data = new Uint8Array(buffer)

  const entries: Array<{ name: string; size: number; data: Uint8Array }> = []
  let offset = 0
  let totalSize = 0

  while (offset + HEADER_SIZE <= data.length) {
    const header = data.subarray(offset, offset + HEADER_SIZE)
    const name = readString(header, 0, 100)
    if (name === '') break

    const size = parseOctal(header, 124, 12)
    const typeFlag = String.fromCharCode(header[156]!)
    const storedChecksum = parseOctal(header, 148, 8)
    const actualChecksum = computeChecksum(header)

    if (storedChecksum !== actualChecksum) {
      throw new Error(`TAR header checksum mismatch at offset ${offset}`)
    }

    offset += HEADER_SIZE
    const fileData = data.slice(offset, offset + size)
    offset += Math.ceil(size / HEADER_SIZE) * HEADER_SIZE

    if (typeFlag === '\0' || typeFlag === '0') {
      if (entries.length >= MAX_ENTRIES) {
        throw new Error(`TAR contains too many entries — aborted for safety`)
      }
      if (hasUnsafePath(name)) {
        continue
      }
      if (nestingDepth(name) > MAX_NESTING_DEPTH) {
        continue
      }
      totalSize += size
      if (totalSize > MAX_TOTAL_UNCOMPRESSED) {
        throw new Error('TAR exceeds the safe extraction limit — aborted for safety')
      }
      entries.push({ name, size, data: fileData })
    }
  }

  checkAbort(signal!)

  if (entries.length === 0) {
    throw new Error('No safe files found in this TAR')
  }

  const desktopOutputDir = options.outputDir as string | undefined
  const directoryHandle = options.directoryHandle as FileSystemDirectoryHandle | undefined

  if (desktopOutputDir || directoryHandle) {
    onProgress?.(30, 'Extracting to chosen folder…')
    const createdFiles: FileSystemFileHandle[] = []
    const createdDirs: FileSystemDirectoryHandle[] = []
    let current = 0
    try {
      for (const entry of entries) {
        checkAbort(signal!)
        current++
        onProgress?.(30 + Math.round((current / entries.length) * 60), `Extracting ${entry.name}…`, {
          index: current,
          total: entries.length,
        })
        if (desktopOutputDir) {
          await writeExtractionEntry(desktopOutputDir, entry.name, entry.data)
        } else {
          const handled = await writeFileToDirectory(directoryHandle!, entry.name, entry.data)
          createdFiles.push(...handled.files)
          createdDirs.push(...handled.dirs)
        }
      }
    } catch (err) {
      if (!desktopOutputDir) {
        for (const f of createdFiles) {
          try { await removeHandle(f) } catch { /* best effort */ }
        }
        for (const d of createdDirs.slice().reverse()) {
          try { await removeHandle(d) } catch { /* best effort */ }
        }
      }
      throw err
    }

    onProgress?.(100, 'Done')
    const manifest = entries.map((e) => ({ name: e.name, size: e.size }))
    return {
      blob: new Blob(
        [`TAR extraction report\n\nFiles: ${entries.length}\nTotal size: ${totalSize.toLocaleString()} bytes\n\n` +
          manifest.map((m) => `${m.name} (${m.size} bytes)`).join('\n')],
        { type: 'text/plain' },
      ),
      filename: generateOutputName(file.name, 'extracted', 'txt'),
    }
  }

  // Fallback: re-package as ZIP
  onProgress?.(30, 'Packaging as ZIP…')
  const JSZip = (await import('jszip')).default
  const outZip = new JSZip()
  let current = 0
  for (const entry of entries) {
    checkAbort(signal!)
    current++
    onProgress?.(30 + Math.round((current / entries.length) * 50), `Processing ${entry.name}…`, {
      index: current,
      total: entries.length,
    })
    outZip.file(sanitizeFilename(entry.name), entry.data)
  }

  onProgress?.(85, 'Compressing…')
  const blobOut = await outZip.generateAsync({ type: 'blob' })
  onProgress?.(100, 'Done')

  return {
    blob: blobOut,
    filename: generateOutputName(file.name, 'extracted', 'zip'),
  }
}

function getFileExtensionSafe(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function removeHandle(handle: FileSystemFileHandle | FileSystemDirectoryHandle): Promise<void> {
  return (handle as unknown as { remove(): Promise<void> }).remove()
}

interface WritableHandles {
  files: FileSystemFileHandle[]
  dirs: FileSystemDirectoryHandle[]
}

async function writeFileToDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
  data: Uint8Array,
): Promise<WritableHandles> {
  const parts = path.split('/')
  const files: FileSystemFileHandle[] = []
  const dirs: FileSystemDirectoryHandle[] = []
  let handle = root
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    if (part === '') continue
    handle = await handle.getDirectoryHandle(sanitizeFilename(part), { create: true })
    dirs.push(handle)
  }
  const leaf = parts[parts.length - 1]!
  const fileHandle = await handle.getFileHandle(sanitizeFilename(leaf), { create: true })
  files.push(fileHandle)
  const writable = await fileHandle.createWritable()
  await writable.write(data.buffer as ArrayBuffer)
  await writable.close()
  return { files, dirs }
}
