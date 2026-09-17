import type { ConversionResult } from '@/types/engine'
import type { FileMeta, JobProgressDetail } from '@/types/job'
import { readFileAsBlob, writeExtractionEntry } from '@/services/file-service'
import { generateOutputName, sanitizeFilename } from '@/utils/filename'
import { checkAbort } from '@/utils/abort'
import { BatchError } from '@/utils/batch-error'

const MAX_ENTRIES = 2000
const MAX_TOTAL_UNCOMPRESSED = 4 * 1024 * 1024 * 1024
const MAX_NESTING_DEPTH = 32

interface JsZipObjectPrivate {
  _data?: { uncompressedSize?: number }
}

function entryUncompressedSize(entry: object): number {
  return (entry as JsZipObjectPrivate)._data?.uncompressedSize ?? 0
}

export function hasUnsafePath(path: string): boolean {
  if (path.includes('\\')) return true
  if (path.includes('..')) return true
  if (/^[a-z]:/i.test(path)) return true
  if (/^~/.test(path)) return true
  if (path.startsWith('/')) return true
  const sanitized = sanitizeFilename(path.split('/').join('_'))
  return sanitized === ''
}

export function nestingDepth(path: string): number {
  return path.split('/').length
}

export async function createZip(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  if (inputs.length === 0) {
    throw new Error('Select at least one file to create a ZIP')
  }

  const compression = Number(options.level) || 6
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    checkAbort(signal!)
    onProgress?.(Math.round((i / inputs.length) * 50), `Adding ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })

    try {
      const blob = await readFileAsBlob(file)
      zip.file(file.name, blob)
    } catch (err) {
      if (signal?.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }
  if (failed.length > 0) {
    throw new BatchError(
      `${inputs.length - failed.length} of ${inputs.length} files were added, but ${failed.length} could not be read.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }

  checkAbort(signal!)
  onProgress?.(60, 'Compressing…')

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: compression } },
    (metadata) => {
      checkAbort(signal!)
      onProgress?.(60 + Math.round(metadata.percent * 0.38), 'Compressing…')
    },
  )

  checkAbort(signal!)
  onProgress?.(100, 'Done')
  return {
    blob,
    filename: generateOutputName(inputs[0]!.name, 'files', 'zip'),
  }
}

export interface ZipEntryInfo {
  name: string
  dir: boolean
  uncompressedSize: number
}

export async function listZipContents(file: File): Promise<ZipEntryInfo[]> {
  const ZipConstructor = (await import('jszip')).default
  const zip = await ZipConstructor.loadAsync(file)
  return Object.values(zip.files).map((entry) => ({
    name: entry.name,
    dir: entry.dir,
    uncompressedSize: entryUncompressedSize(entry),
  }))
}

export interface ExtractManifest {
  files: Array<{ name: string; size: number }>
  totalFiles: number
  totalSize: number
  skipped: string[]
  destination: string
  fallback: boolean
}

function manifestToBlob(manifest: ExtractManifest): Blob {
  const lines = [
    `FileForge extraction report — ${manifest.destination}`,
    '',
    `Files extracted: ${manifest.totalFiles}`,
    `Total size: ${manifest.totalSize.toLocaleString()} bytes`,
    '',
    ...manifest.files.map((f) => `${f.name} (${f.size} bytes)`),
  ]
  if (manifest.skipped.length > 0) {
    lines.push('', 'Skipped (unsafe paths):', ...manifest.skipped)
  }
  if (manifest.fallback) {
    lines.push('', 'Note: saved as a ZIP because folder extraction is not supported in this browser.')
  }
  return new Blob([lines.join('\n')], { type: 'text/plain' })
}

export async function extractZip(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = inputs[0]!
  if (getFileExtensionSafe(file.name) !== 'zip') {
    throw new Error('Select a ZIP file to extract')
  }

  onProgress?.(10, 'Reading ZIP…')
  const blob = await readFileAsBlob(file)
  checkAbort(signal!)
  const ZipConstructor = (await import('jszip')).default
  const zip = await ZipConstructor.loadAsync(blob)

  const entries = Object.values(zip.files)
  const skipped: string[] = []

  let totalSize = 0
  let kept = 0
  for (const entry of entries) {
    if (entry.dir) continue
    if (entries.length > MAX_ENTRIES) {
      throw new Error(`ZIP contains too many entries (${entries.length}) — aborted for safety`)
    }
    if (hasUnsafePath(entry.name)) {
      skipped.push(entry.name)
      continue
    }
    if (nestingDepth(entry.name) > MAX_NESTING_DEPTH) {
      skipped.push(`${entry.name} (too deeply nested)`)
      continue
    }
    totalSize += entryUncompressedSize(entry)
    if (totalSize > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('ZIP exceeds the safe extraction limit — aborted for safety')
    }
    kept++
  }
  checkAbort(signal!)

  if (kept === 0) {
    throw new Error('No safe files found in this ZIP')
  }

  const selectedEntries = options.selectedEntries as string[] | undefined
  const isFiltered = Array.isArray(selectedEntries) && 'selectedEntries' in options
  const selectedSet = isFiltered ? new Set(selectedEntries) : null

  function shouldExtract(entryName: string): boolean {
    if (hasUnsafePath(entryName)) return false
    if (nestingDepth(entryName) > MAX_NESTING_DEPTH) return false
    if (selectedSet && !selectedSet.has(entryName)) return false
    return true
  }

  const extractable = entries.filter((e) => !e.dir && shouldExtract(e.name))

  if (extractable.length === 0) {
    throw new Error(isFiltered ? 'No selected files to extract' : 'No safe files found in this ZIP')
  }

  let extractTotalSize = 0
  for (const e of extractable) {
    extractTotalSize += entryUncompressedSize(e)
    if (extractTotalSize > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('ZIP exceeds the safe extraction limit — aborted for safety')
    }
  }

  const desktopOutputDir = options.outputDir as string | undefined
  const directoryHandle = options.directoryHandle as FileSystemDirectoryHandle | undefined

  if (desktopOutputDir || directoryHandle) {
    onProgress?.(30, 'Extracting to chosen folder…')
    const createdFiles: FileSystemFileHandle[] = []
    const createdDirs: FileSystemDirectoryHandle[] = []
    let current = 0
    try {
      for (const entry of extractable) {
        checkAbort(signal!)
        current++
        onProgress?.(30 + Math.round((current / extractable.length) * 60), `Extracting ${entry.name}…`, {
          index: current,
          total: extractable.length,
        })

        const data = await entry.async('uint8array')
        if (desktopOutputDir) {
          await writeExtractionEntry(desktopOutputDir, entry.name, data)
        } else {
          const handled = await writeFileToDirectory(directoryHandle!, entry.name, data)
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
    const manifest: ExtractManifest = {
      files: extractable.map((e) => ({ name: e.name, size: entryUncompressedSize(e) })),
      totalFiles: extractable.length,
      totalSize: extractTotalSize,
      skipped,
      destination: desktopOutputDir || directoryHandle?.name || 'chosen folder',
      fallback: false,
    }
    return {
      blob: manifestToBlob(manifest),
      filename: generateOutputName(file.name, 'extracted', 'txt'),
    }
  }

  // Fallback: re-package extracted files into a safe ZIP
  onProgress?.(30, 'Preparing files…')
  const OutZipConstructor = (await import('jszip')).default
  const outZip = new OutZipConstructor()
  let current = 0
  for (const entry of extractable) {
    checkAbort(signal!)
    current++
    onProgress?.(30 + Math.round((current / extractable.length) * 50), `Processing ${entry.name}…`, {
      index: current,
      total: extractable.length,
    })
    const data = await entry.async('uint8array')
    outZip.file(sanitizeFilename(entry.name), data)
  }

  onProgress?.(85, 'Packaging…')
  const manifest: ExtractManifest = {
    files: extractable.map((e) => ({ name: e.name, size: entryUncompressedSize(e) })),
    totalFiles: extractable.length,
    totalSize: extractTotalSize,
    skipped,
    destination: sanitizeFilename(file.name.replace(/\.[^.]+$/, '') + '_extracted'),
    fallback: true,
  }
  outZip.file('_extraction_report.txt', manifestToBlob(manifest))
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
    handle = await handle.getDirectoryHandle(
      sanitizeFilename(part),
      { create: true },
    )
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