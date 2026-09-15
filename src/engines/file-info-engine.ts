import type { FileMeta } from '@/types/job'
import { readFileAsBlob } from '@/services/file-service'
import { getFileExtension } from '@/utils/filename'
import type { ImageMetadata } from '@/utils/exif'

export interface FileInfo {
  name: string
  size: number
  type: string
  extension: string
  lastModified: number
  dimensions?: { width: number; height: number }
  metadata?: ImageMetadata
  duration?: number
  bitrate?: number
  pageCount?: number
  hash?: string
}

const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|bmp|avif)$/
const MEDIA_EXT = /^(mp4|m4v|mov|webm|mp3|wav|m4a|flac|ogg|aac)$/
const PDF_EXT = 'pdf'

export async function getFileInfo(file: FileMeta): Promise<FileInfo> {
  const blob = await readFileAsBlob(file)
  const ext = getFileExtension(file.name)

  const info: FileInfo = {
    name: file.name,
    size: file.size,
    type: file.type || blob.type || 'Unknown',
    extension: ext || '—',
    lastModified: file.lastModified,
  }

  if (IMAGE_MIME.test(blob.type)) {
    try {
      info.dimensions = await readImageDimensions(blob)
    } catch {
      // skip
    }
    try {
      if (blob.type === 'image/jpeg' || blob.type === 'image/webp') {
        const { readImageMetadata } = await import('@/utils/exif')
        const meta = await readImageMetadata(blob)
        if (meta.make || meta.model || meta.dateTaken) info.metadata = meta
      }
    } catch {
      // skip
    }
  }

  if (MEDIA_EXT.test(ext)) {
    try {
      const media = await readMediaInfo(blob, ext)
      if (media) {
        if (media.duration) info.duration = media.duration
        if (media.bitrate) info.bitrate = media.bitrate
      }
    } catch {
      // skip
    }
  }

  if (ext === PDF_EXT) {
    try {
      const pageCount = await readPdfPageCount(blob)
      if (pageCount > 0) info.pageCount = pageCount
    } catch {
      // skip
    }
  }

  return info
}

export function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions'))
    }
    img.src = url
  })
}

export function formatInfoValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString()
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

async function computeSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function computeFileHash(file: FileMeta): Promise<string> {
  const blob = await readFileAsBlob(file)
  return computeSha256(blob)
}

interface MediaInfo {
  duration?: number
  bitrate?: number
}

function readMediaInfo(blob: Blob, ext: string): Promise<MediaInfo | null> {
  if (ext === 'mp3') return readMp3Info(blob)
  if (ext === 'wav') return readWavInfo(blob)
  if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return readMp4Info(blob)
  return Promise.resolve(null)
}

type Mp3Info = { duration?: number; bitrate?: number }

function readMp3Info(blob: Blob): Promise<Mp3Info | null> {
  return blob.slice(0, 4).arrayBuffer().then((headerBuf) => {
    const header = new Uint8Array(headerBuf)
    if (header.length < 4 || header[0] !== 0xff || (header[1]! & 0xe0) !== 0xe0) return null
    const ver = (header[1]! >> 3) & 0x03
    const layer = (header[1]! >> 1) & 0x03
    const bitrate = (header[2]! >> 4) & 0x0f
    const sampleRateIdx = (header[2]! >> 2) & 0x03

    const bitrateTable = layer === 1 ? 
      [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448] : 
      [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    if (ver === 1 || sampleRateIdx === 3 || bitrate === 0 || bitrate === 15) return null

    const kbps = bitrateTable[bitrate] ?? 0
    if (kbps === 0) return null

    return blob.arrayBuffer().then((full) => {
      const size = full.byteLength
      const duration = (size * 8) / (kbps * 1000)
      return duration > 0 ? { duration, bitrate: kbps * 1000 } : null
    })
  })
}

function readWavInfo(blob: Blob): Promise<MediaInfo | null> {
  return blob.slice(0, 44).arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf)
    const fmt = String.fromCharCode(...Array.from(bytes.subarray(0, 4)))
    if (fmt !== 'RIFF') return null
    const byteRate = bytes[28]! | (bytes[29]! << 8) | (bytes[30]! << 16) | (bytes[31]! << 24)
    if (byteRate === 0) return null
    return blob.arrayBuffer().then((full) => {
      const dataSize = full.byteLength - 44 > 0 ? full.byteLength - 44 : 0
      return {
        duration: dataSize / byteRate,
        bitrate: byteRate * 8,
      }
    })
  })
}

function readMp4Info(blob: Blob): Promise<MediaInfo | null> {
  return blob.slice(0, 65536).arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf)
    return parseMvhd(bytes)
  })
}

function parseMvhd(bytes: Uint8Array): MediaInfo | null {
  let offset = 0
  while (offset + 8 <= bytes.length) {
    const size = (bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!)
    if (type === 'moov') {
      const nested = bytes.subarray(offset + 8, offset + size)
      const child = parseMvhd(nested)
      if (child?.duration) return child
    }
    if (type === 'mvhd') {
      const version = bytes[offset + 8]
      if (version === 0) {
        const timescale = (bytes[offset + 20]! << 24) | (bytes[offset + 21]! << 16) | (bytes[offset + 22]! << 8) | bytes[offset + 23]!
        const duration = (bytes[offset + 24]! << 24) | (bytes[offset + 25]! << 16) | (bytes[offset + 26]! << 8) | bytes[offset + 27]!
        if (timescale > 0) return { duration: duration / timescale }
      } else {
        const timescale = (bytes[offset + 28]! << 24) | (bytes[offset + 29]! << 16) | (bytes[offset + 30]! << 8) | bytes[offset + 31]!
        const durationLow = (bytes[offset + 32]! << 24) | (bytes[offset + 33]! << 16) | (bytes[offset + 34]! << 8) | bytes[offset + 35]!
        const durationHigh = (bytes[offset + 36]! << 24) | (bytes[offset + 37]! << 16) | (bytes[offset + 38]! << 8) | bytes[offset + 39]!
        const duration = (durationHigh * 0x100000000) + (durationLow >>> 0)
        if (timescale > 0) return { duration: duration / timescale }
      }
      return null
    }
    if (size <= 0) break
    offset += size
  }
  return null
}

async function readPdfPageCount(blob: Blob): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  const arrayBuffer = await blob.arrayBuffer()
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true, throwOnInvalidObject: false })
  return doc.getPageCount()
}