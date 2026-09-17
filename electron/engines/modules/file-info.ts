import fsp from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { getFileExtension } from '../util/common'
import { readImageMetadata } from '../util/exif'
import type { ImageMetadata } from '../util/exif'
import type { EngineContext } from '../types'

export interface FileInfo {
  name: string
  size: number
  type: string
  extension: string
  lastModified?: number
  dimensions?: { width: number; height: number }
  metadata?: ImageMetadata
  duration?: number
  bitrate?: number
  pageCount?: number
  hash?: string
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  zip: 'application/zip',
  tar: 'application/x-tar',
}

const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|bmp|avif)$/
const MEDIA_EXT = /^(mp4|m4v|mov|webm|mp3|wav|m4a|flac|ogg|aac)$/

function readImageDimensions(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  return import('@napi-rs/canvas').then(async ({ loadImage }) => {
    const img = await loadImage(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    return { width: img.width, height: img.height }
  })
}

async function hashFileStream(filePath: string, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) {
    if (signal?.aborted) break
    hash.update(chunk as Buffer)
  }
  return hash.digest('hex')
}

interface MediaInfo {
  duration?: number
  bitrate?: number
}

function readMediaInfo(bytes: Uint8Array, ext: string): MediaInfo | null {
  if (ext === 'mp3') return readMp3Info(bytes)
  if (ext === 'wav') return readWavInfo(bytes)
  if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return readMp4Info(bytes)
  return null
}

function readMp3Info(bytes: Uint8Array): MediaInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || (bytes[1]! & 0xe0) !== 0xe0) return null
  const layer = (bytes[1]! >> 1) & 0x03
  const bitrate = (bytes[2]! >> 4) & 0x0f
  const sampleRateIdx = (bytes[2]! >> 2) & 0x03

  const bitrateTable =
    layer === 1
      ? [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448]
      : [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  if (sampleRateIdx === 3 || bitrate === 0 || bitrate === 15) return null

  const kbps = bitrateTable[bitrate] ?? 0
  if (kbps === 0) return null

  const duration = (bytes.length * 8) / (kbps * 1000)
  return duration > 0 ? { duration, bitrate: kbps * 1000 } : null
}

function readWavInfo(bytes: Uint8Array): MediaInfo | null {
  if (bytes.length < 44) return null
  const fmt = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
  if (fmt !== 'RIFF') return null
  const byteRate = bytes[28]! | (bytes[29]! << 8) | (bytes[30]! << 16) | (bytes[31]! << 24)
  if (byteRate === 0) return null
  const dataSize = bytes.length - 44 > 0 ? bytes.length - 44 : 0
  return {
    duration: dataSize / byteRate,
    bitrate: byteRate * 8,
  }
}

function readMp4Info(bytes: Uint8Array): MediaInfo | null {
  return parseMvhd(bytes.subarray(0, 65536))
}

function parseMvhd(bytes: Uint8Array): MediaInfo | null {
  let offset = 0
  while (offset + 8 <= bytes.length) {
    const size =
      (bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    )
    if (type === 'moov' && size > 8) {
      const nested = bytes.subarray(offset + 8, offset + size)
      const child = parseMvhd(nested)
      if (child?.duration) return child
    }
    if (type === 'mvhd') {
      const version = bytes[offset + 8]
      if (version === 0) {
        const timescale =
          (bytes[offset + 20]! << 24) | (bytes[offset + 21]! << 16) | (bytes[offset + 22]! << 8) | bytes[offset + 23]!
        const duration =
          (bytes[offset + 24]! << 24) | (bytes[offset + 25]! << 16) | (bytes[offset + 26]! << 8) | bytes[offset + 27]!
        if (timescale > 0) return { duration: duration / timescale }
      } else {
        const timescale =
          (bytes[offset + 28]! << 24) | (bytes[offset + 29]! << 16) | (bytes[offset + 30]! << 8) | bytes[offset + 31]!
        const durationLow =
          (bytes[offset + 32]! << 24) | (bytes[offset + 33]! << 16) | (bytes[offset + 34]! << 8) | bytes[offset + 35]!
        const durationHigh =
          (bytes[offset + 36]! << 24) | (bytes[offset + 37]! << 16) | (bytes[offset + 38]! << 8) | bytes[offset + 39]!
        const duration = durationHigh * 0x100000000 + (durationLow >>> 0)
        if (timescale > 0) return { duration: duration / timescale }
      }
      return null
    }
    if (size <= 0) break
    offset += size
  }
  return null
}

async function readPdfPageCount(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false })
  return doc.getPageCount()
}

export async function getFileInfo(
  file: { path: string; name: string; size: number; lastModified?: number },
  ctx: EngineContext,
): Promise<FileInfo> {
  const ext = getFileExtension(file.name)

  const info: FileInfo = {
    name: file.name,
    size: file.size,
    type: MIME_BY_EXT[ext] || 'Unknown',
    extension: ext || '—',
    lastModified: file.lastModified,
  }

  const stat = await fsp.stat(file.path)
  if (info.lastModified === undefined) info.lastModified = stat.mtimeMs

  try {
    const buf = await fsp.readFile(file.path)
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

    if (IMAGE_MIME.test(info.type)) {
      try {
        info.dimensions = await readImageDimensions(bytes)
      } catch {
        // skip
      }
      try {
        if (info.type === 'image/jpeg' || info.type === 'image/webp') {
          const meta = await readImageMetadata(bytes)
          if (meta.make || meta.model || meta.dateTaken) info.metadata = meta
        }
      } catch {
        // skip
      }
    }

    if (MEDIA_EXT.test(ext)) {
      try {
        const media = readMediaInfo(bytes, ext)
        if (media) {
          if (media.duration) info.duration = media.duration
          if (media.bitrate) info.bitrate = media.bitrate
        }
      } catch {
        // skip
      }
    }

    if (ext === 'pdf') {
      try {
        const pageCount = await readPdfPageCount(bytes)
        if (pageCount > 0) info.pageCount = pageCount
      } catch {
        // skip
      }
    }

    info.hash = await hashFileStream(file.path, ctx.signal)
  } catch {
    // reading may fail for locked files; still return available metadata
  }

  return info
}

export function formatInfoValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString()
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}