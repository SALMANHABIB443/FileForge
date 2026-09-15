import type { ConversionResult } from '@/types/engine'
import type { FileMeta } from '@/types/job'
import { readFileAsBlob } from '@/services/file-service'
import { generateOutputName, getFileExtension, resolveCollision } from '@/utils/filename'
import { transferExifToJpeg } from '@/utils/exif'
import { checkAbort } from '@/utils/abort'
import { zipBlobs } from '@/utils/zip'

type ImageFormat = 'jpeg' | 'png' | 'webp'

const MIME_MAP: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const EXT_MAP: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
}

const FORMAT_BY_EXT: Record<string, ImageFormat> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
}

type FitMode = 'contain' | 'cover' | 'stretch'

type CropRect = { x: number; y: number; width: number; height: number }

interface RenderOptions {
  format: ImageFormat
  quality: number
  maxWidth?: number
  maxHeight?: number
  fit: FitMode
  background?: string
  crop?: CropRect
  rotation?: Rotation
}

type Rotation = 0 | 90 | 180 | 270

export function coerceQuality(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(1, Math.round(n)))
}

export function coerceDimension(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === '') return fallback
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

export function coerceRotation(value: unknown): Rotation {
  const n = Number(value)
  if (n === 90 || n === 180 || n === 270) return n as Rotation
  return 0
}

export function coerceCrop(value: unknown, srcW: number, srcH: number): CropRect | undefined {
  if (!value || typeof value !== 'object') return undefined
  const c = value as Record<string, unknown>
  const x = coerceDimension(c.x, 0) ?? 0
  const y = coerceDimension(c.y, 0) ?? 0
  const width = Math.min(coerceDimension(c.width, srcW) ?? srcW, srcW - x)
  const height = Math.min(coerceDimension(c.height, srcH) ?? srcH, srcH - y)
  if (width <= 0 || height <= 0) return undefined
  return {
    x: Math.max(0, Math.min(x, srcW - 1)),
    y: Math.max(0, Math.min(y, srcH - 1)),
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

export function toImageFormat(value: unknown, fallback: ImageFormat): ImageFormat {
  if (value === 'jpeg' || value === 'jpg' || value === 'png' || value === 'webp') {
    return value === 'jpg' ? 'jpeg' : (value as ImageFormat)
  }
  return fallback
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not decode this image'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  const normalized = quality != null ? quality / 100 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      mime,
      normalized,
    )
  })
}

async function render(source: HTMLImageElement, options: RenderOptions): Promise<Blob> {
  const srcW = source.naturalWidth
  const srcH = source.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser')

  if (options.crop) {
    const c = options.crop
    const rotation = options.rotation ?? 0
    const swap = rotation === 90 || rotation === 270
    canvas.width = swap ? c.height : c.width
    canvas.height = swap ? c.width : c.height
    ctx.save()
    switch (rotation) {
      case 90:
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
        break
      case 180:
        ctx.translate(canvas.width, canvas.height)
        ctx.rotate(Math.PI)
        break
      case 270:
        ctx.translate(0, canvas.height)
        ctx.rotate(-Math.PI / 2)
        break
    }
    ctx.drawImage(source, c.x, c.y, c.width, c.height, 0, 0, c.width, c.height)
    ctx.restore()
  } else if (options.rotation) {
    const rotation = options.rotation
    const swap = rotation === 90 || rotation === 270
    canvas.width = swap ? srcH : srcW
    canvas.height = swap ? srcW : srcH
    ctx.save()
    switch (rotation) {
      case 90:
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
        break
      case 180:
        ctx.translate(canvas.width, canvas.height)
        ctx.rotate(Math.PI)
        break
      case 270:
        ctx.translate(0, canvas.height)
        ctx.rotate(-Math.PI / 2)
        break
    }
    ctx.drawImage(source, 0, 0)
    ctx.restore()
  } else {
    const hasBox =
      (options.maxWidth && options.maxWidth > 0) || (options.maxHeight && options.maxHeight > 0)
    const boxW = options.maxWidth && options.maxWidth > 0 ? options.maxWidth : srcW
    const boxH = options.maxHeight && options.maxHeight > 0 ? options.maxHeight : srcH

    if (hasBox && options.fit === 'cover') {
      canvas.width = boxW
      canvas.height = boxH
      const scale = Math.max(boxW / srcW, boxH / srcH)
      const sw = boxW / scale
      const sh = boxH / scale
      const sx = (srcW - sw) / 2
      const sy = (srcH - sh) / 2
      if (options.background) {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, boxW, boxH)
      }
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, boxW, boxH)
    } else if (hasBox && options.fit === 'stretch') {
      canvas.width = boxW
      canvas.height = boxH
      if (options.background) {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, boxW, boxH)
      }
      ctx.drawImage(source, 0, 0, boxW, boxH)
    } else if (hasBox) {
      const scale = Math.min(boxW / srcW, boxH / srcH)
      const drawW = Math.max(1, Math.round(srcW * scale))
      const drawH = Math.max(1, Math.round(srcH * scale))
      canvas.width = drawW
      canvas.height = drawH
      if (options.background) {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, drawW, drawH)
      }
      ctx.drawImage(source, 0, 0, drawW, drawH)
    } else {
      canvas.width = srcW
      canvas.height = srcH
      if (options.background) {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, srcW, srcH)
      }
      ctx.drawImage(source, 0, 0)
    }
  }

  return canvasToBlob(canvas, MIME_MAP[options.format], options.quality)
}

function transparencyBackground(blob: Blob, targetFormat: ImageFormat): string | undefined {
  const isTransparentSource = blob.type === 'image/png' || blob.type === 'image/webp'
  return isTransparentSource && targetFormat === 'jpeg' ? '#ffffff' : undefined
}

async function applyMetadataPolicy(
  sourceBlob: Blob,
  outputBlob: Blob,
  format: ImageFormat,
  stripMetadata: boolean,
): Promise<Blob> {
  if (stripMetadata) return outputBlob
  if (format !== 'jpeg' || sourceBlob.type !== 'image/jpeg') return outputBlob
  try {
    const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer())
    const outputBytes = new Uint8Array(await outputBlob.arrayBuffer())
    const merged = transferExifToJpeg(sourceBytes, outputBytes)
    return new Blob([merged.buffer as ArrayBuffer], { type: 'image/jpeg' })
  } catch {
    return outputBlob
  }
}

type ImageOperation = (
  file: FileMeta,
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
) => Promise<ConversionResult>

async function runImageBatch(
  files: FileMeta[],
  options: Record<string, unknown>,
  run: ImageOperation,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
  suffix = 'converted',
): Promise<ConversionResult> {
  const first = files[0]!
  if (files.length === 1) return run(first, options, onProgress, signal)

  const existingNames = new Set<string>()
  const entries: { name: string; blob: Blob }[] = []
  for (let i = 0; i < files.length; i++) {
    checkAbort(signal)
    onProgress?.(((i + 1) / files.length) * 90, `Processing ${files[i]!.name}…`)
    const result = await run(files[i]!, options, undefined, signal)
    checkAbort(signal)
    const name = resolveCollision(result.filename, existingNames)
    existingNames.add(name)
    entries.push({ name, blob: result.blob })
  }
  onProgress?.(95, 'Writing ZIP…')
  const blob = await zipBlobs(entries)
  checkAbort(signal)
  onProgress?.(100, 'Done')
  return { blob, filename: generateOutputName(first.name, suffix, 'zip') }
}

const convertOne: ImageOperation = async (file, options, onProgress, signal) => {
  const format = toImageFormat(options.format, 'jpeg')
  const quality = coerceQuality(options.quality, 85)
  const strip = options.stripMetadata !== false

  onProgress?.(5, 'Reading file…')
  checkAbort(signal)
  const blob = await readFileAsBlob(file)
  checkAbort(signal)

  onProgress?.(25, 'Decoding image…')
  const source = await loadImage(blob)
  checkAbort(signal)

  onProgress?.(60, `Encoding ${EXT_MAP[format].toUpperCase()}…`)
  let output = await render(source, {
    format,
    quality,
    fit: 'contain',
    background: transparencyBackground(blob, format),
  })
  output = await applyMetadataPolicy(blob, output, format, strip)
  checkAbort(signal)

  onProgress?.(100, 'Done')
  return { blob: output, filename: generateOutputName(file.name, format === 'jpeg' ? 'jpg' : format, EXT_MAP[format]) }
}

export async function convertImage(
  files: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  return runImageBatch(files, options, convertOne, onProgress, signal, 'converted')
}

const compressOne: ImageOperation = async (file, options, onProgress, signal) => {
  const originalExt = getFileExtension(file.name)
  const format = FORMAT_BY_EXT[originalExt] ?? 'jpeg'
  const quality = coerceQuality(options.quality, 80)
  const maxDimension = coerceDimension(options.maxDimension)
  const strip = options.stripMetadata !== false

  onProgress?.(5, 'Reading file…')
  checkAbort(signal)
  const blob = await readFileAsBlob(file)
  checkAbort(signal)

  onProgress?.(25, 'Decoding image…')
  const source = await loadImage(blob)
  checkAbort(signal)

  let maxWidth: number | undefined
  let maxHeight: number | undefined
  if (maxDimension) {
    const scale = Math.min(maxDimension / source.naturalWidth, maxDimension / source.naturalHeight)
    if (scale < 1) {
      maxWidth = Math.max(1, Math.round(source.naturalWidth * scale))
      maxHeight = Math.max(1, Math.round(source.naturalHeight * scale))
    }
  }

  onProgress?.(60, 'Re-encoding image…')
  let output = await render(source, {
    format,
    quality,
    fit: 'contain',
    maxWidth,
    maxHeight,
    background: transparencyBackground(blob, format),
  })
  output = await applyMetadataPolicy(blob, output, format, strip)
  checkAbort(signal)

  onProgress?.(100, 'Done')
  return { blob: output, filename: generateOutputName(file.name, 'compressed', EXT_MAP[format]) }
}

export async function compressImage(
  files: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  return runImageBatch(files, options, compressOne, onProgress, signal, 'compressed')
}

const resizeOne: ImageOperation = async (file, options, onProgress, signal) => {
  const width = coerceDimension(options.width)
  const height = coerceDimension(options.height)
  const fit = (options.fit as FitMode) ?? 'contain'
  const quality = coerceQuality(options.quality, 90)
  const strip = options.stripMetadata !== false

  onProgress?.(5, 'Reading file…')
  checkAbort(signal)
  const blob = await readFileAsBlob(file)
  checkAbort(signal)

  onProgress?.(25, 'Decoding image…')
  const source = await loadImage(blob)
  checkAbort(signal)

  const srcW = source.naturalWidth
  const srcH = source.naturalHeight
  const maintainAspect = options.maintainAspect !== false

  let targetW = width
  let targetH = height

  if (maintainAspect && (width || height)) {
    if (width && !height) {
      targetH = Math.max(1, Math.round((width / srcW) * srcH))
    } else if (height && !width) {
      targetW = Math.max(1, Math.round((height / srcH) * srcW))
    }
  } else if (!width && !height) {
    targetW = srcW
    targetH = srcH
  }

  const format = FORMAT_BY_EXT[getFileExtension(file.name)] ?? 'jpeg'

  onProgress?.(60, 'Resizing image…')
  let output = await render(source, {
    format,
    quality,
    fit,
    maxWidth: targetW,
    maxHeight: targetH,
    background: transparencyBackground(blob, format),
  })
  output = await applyMetadataPolicy(blob, output, format, strip)
  checkAbort(signal)

  onProgress?.(100, 'Done')
  return { blob: output, filename: generateOutputName(file.name, 'resized', EXT_MAP[format]) }
}

export async function resizeImage(
  files: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  return runImageBatch(files, options, resizeOne, onProgress, signal, 'resized')
}

export async function cropImage(
  files: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = files[0]!
  const format = toImageFormat(options.format, 'jpeg')
  const quality = coerceQuality(options.quality, 90)
  const rotation = coerceRotation(options.rotation)
  const strip = options.stripMetadata !== false

  onProgress?.(5, 'Reading file…')
  checkAbort(signal)
  const blob = await readFileAsBlob(file)
  checkAbort(signal)

  onProgress?.(25, 'Decoding image…')
  const source = await loadImage(blob)
  checkAbort(signal)

  const crop = coerceCrop(options.crop, source.naturalWidth, source.naturalHeight)

  onProgress?.(60, 'Applying crop…')
  let output = await render(source, {
    format,
    quality,
    fit: 'contain',
    crop,
    rotation,
    background: transparencyBackground(blob, format),
  })
  output = await applyMetadataPolicy(blob, output, format, strip)
  checkAbort(signal)

  onProgress?.(100, 'Done')
  return { blob: output, filename: generateOutputName(file.name, 'cropped', EXT_MAP[format]) }
}