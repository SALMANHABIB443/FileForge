import fsp from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { checkAbort, generateOutputName, sanitizeFilename, writeOutput } from '../util/common'
import { MAX_ENTRIES, MAX_NESTING_DEPTH, MAX_TOTAL_UNCOMPRESSED, hasUnsafePath, nestingDepth, writeExtractionManifest } from '../util/zip'
import { safeJoin } from '../../security/path-validation'
import type { EngineContext, EngineResult } from '../types'

const HEADER_SIZE = 512

function assertTarInput(file: { name: string }): void {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (ext !== 'tar') {
    throw new Error('Select a TAR file to extract')
  }
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

interface ParsedTarEntry {
  name: string
  size: number
  data: Uint8Array
}

function parseTar(data: Uint8Array, url: string): ParsedTarEntry[] {
  const entries: ParsedTarEntry[] = []
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

  if (entries.length === 0) {
    throw new Error('No safe files found in this TAR')
  }
  void url
  return entries
}

export async function extractTar(
  inputs: { path: string; name: string }[],
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  const file = inputs[0]!
  assertTarInput(file)

  ctx.onProgress(10, 'Reading TAR…')
  checkAbort(ctx.signal)
  const buf = await fsp.readFile(file.path)
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const entries = parseTar(data, file.name)
  checkAbort(ctx.signal)

  const desktopOutputDir = typeof options.outputDir === 'string' ? options.outputDir : undefined

  if (desktopOutputDir) {
    ctx.onProgress(30, 'Extracting to chosen folder…')
    const root = path.resolve(desktopOutputDir)
    let current = 0
    for (const entry of entries) {
      checkAbort(ctx.signal)
      current++
      ctx.onProgress(30 + Math.round((current / entries.length) * 60), `Extracting ${entry.name}…`, {
        index: current,
        total: entries.length,
      })
      const target = safeJoin(root, entry.name)
      await fsp.mkdir(path.dirname(target), { recursive: true })
      await fsp.writeFile(target, entry.data)
    }
    ctx.onProgress(100, 'Done')
    return writeExtractionManifest(
      ctx,
      {
        title: 'FileForge extraction report',
        files: entries.map((e) => ({ name: e.name, size: e.size })),
        skipped: [],
        destination: root,
        fallback: false,
      },
      file.name,
    )
  }

  // Fallback: re-package as ZIP
  ctx.onProgress(30, 'Packaging as ZIP…')
  const zip = new JSZip()
  let current = 0
  for (const entry of entries) {
    checkAbort(ctx.signal)
    current++
    ctx.onProgress(30 + Math.round((current / entries.length) * 50), `Processing ${entry.name}…`, {
      index: current,
      total: entries.length,
    })
    zip.file(sanitizeFilename(entry.name), entry.data)
  }

  ctx.onProgress(85, 'Compressing…')
  checkAbort(ctx.signal)
  const out = await zip.generateAsync({ type: 'nodebuffer' })

  ctx.onProgress(100, 'Done')
  return writeOutput(ctx, generateOutputName(file.name, 'extracted', 'zip'), out)
}