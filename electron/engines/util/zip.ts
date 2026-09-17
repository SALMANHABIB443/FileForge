import JSZip from 'jszip'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { checkAbort, generateOutputName, sanitizeFilename, toBuffer, writeOutput } from './common'
import type { EngineContext, EngineFileResult } from '../types'

export const MAX_ENTRIES = 2000
export const MAX_TOTAL_UNCOMPRESSED = 4 * 1024 * 1024 * 1024
export const MAX_NESTING_DEPTH = 32

interface JsZipObjectPrivate {
  _data?: { uncompressedSize?: number }
}

export function entryUncompressedSize(entry: object): number {
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
  return path.split('/').filter(Boolean).length
}

export interface ZipEntryToWrite {
  name: string
  data: Uint8Array | ArrayBuffer | Buffer
}

/**
 * Creates a ZIP archive from raw entries and writes it into the job temp dir.
 */
export async function writeZipArchive(
  ctx: EngineContext,
  entries: ZipEntryToWrite[],
  originalName: string,
  suffix: string,
  level = 6,
): Promise<EngineFileResult> {
  const zip = new JSZip()
  for (const entry of entries) {
    zip.file(entry.name, toBuffer(entry.data))
  }
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level },
  })
  checkAbort(ctx.signal)
  const filename = generateOutputName(originalName, suffix, 'zip')
  const target = sanitizeFilename(filename)
  const outputPath = path.join(ctx.workDir, target)
  await fsp.mkdir(ctx.workDir, { recursive: true })
  await fsp.writeFile(outputPath, out)
  return { kind: 'file', filename, outputPath, outputSize: out.byteLength }
}

/**
 * Writes an extraction report as the job's output file and returns it.
 */
export async function writeExtractionManifest(
  ctx: EngineContext,
  manifest: {
    title: string
    files: Array<{ name: string; size: number }>
    skipped: string[]
    destination: string
    fallback: boolean
  },
  originalName: string,
): Promise<EngineFileResult> {
  const lines = [
    `${manifest.title} — ${manifest.destination}`,
    '',
    `Files extracted: ${manifest.files.length}`,
    `Total size: ${manifest.files.reduce((s, f) => s + f.size, 0).toLocaleString()} bytes`,
    '',
    ...manifest.files.map((f) => `${f.name} (${f.size} bytes)`),
  ]
  if (manifest.skipped.length > 0) {
    lines.push('', 'Skipped (unsafe paths):', ...manifest.skipped)
  }
  if (manifest.fallback) {
    lines.push('', 'Note: saved as a ZIP because folder extraction was not available.')
  }
  return writeOutput(ctx, generateOutputName(originalName, 'extracted', 'txt'), Buffer.from(lines.join('\n')))
}