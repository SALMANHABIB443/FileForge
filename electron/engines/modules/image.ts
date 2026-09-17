import fsp from 'node:fs/promises'
import { checkAbort, generateOutputName, getFileExtension, resolveCollision, writeOutput, BatchError } from '../util/common'
import { transferExifToJpeg } from '../util/exif'
import { writeZipArchive } from '../util/zip'
import type { EngineContext, EngineFileResult, EngineResult } from '../types'

type ImageFormat = 'jpeg' | 'png' | 'webp'

export const EXT_MAP: Record<ImageFormat, string> = {
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

export type FitMode = 'contain' | 'cover' | 'stretch'
export type Rotation = 0 | 90 | 180 | 270
export type CropRect = { x: number; y: number; width: number; height: number }

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

async function loadImage(bytes: Uint8Array): Promise<import('@napi-rs/canvas').Image> {
  const { loadImage } = await import('@napi-rs/canvas')
  return loadImage(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
}

function canvasToBytes(
  canvas: import('@napi-rs/canvas').Canvas,
  mime: string,
  quality: number,
): Buffer {
  if (mime === 'image/jpeg') {
    return canvas.toBuffer('image/jpeg', quality)
  }
  if (mime === 'image/webp') {
    try {
      return canvas.toBuffer('image/webp', { quality } as unknown as number)
    } catch {
      return canvas.toBuffer('image/webp')
    }
  }
  return canvas.toBuffer('image/png')
}

async function render(source: import('@napi-rs/canvas').Image, options: RenderOptions): Promise<Buffer> {
  const { createCanvas } = await import('@napi-rs/canvas')
  const srcW = source.width
  const srcH = source.height
  const canvas = createCanvas(1, 1)
  const ctx = canvas.getContext('2d')

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
    const hasBox = options.maxWidth && options.maxWidth > 0 || options.maxHeight && options.maxHeight > 0
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

  const mime = options.format === 'jpeg' ? 'image/jpeg' : options.format === 'webp' ? 'image/webp' : 'image/png'
  return canvasToBytes(canvas, mime, options.quality)
}

function transparencyBackground(fileName: string, targetFormat: ImageFormat): string | undefined {
  const ext = getFileExtension(fileName)
  const isTransparentSource = ext === 'png' || ext === 'webp'
  return isTransparentSource && targetFormat === 'jpeg' ? '#ffffff' : undefined
}

async function applyMetadataPolicy(
  sourceBytes: Uint8Array,
  outputBytes: Buffer,
  format: ImageFormat,
  stripMetadata: boolean,
): Promise<Uint8Array> {
  if (stripMetadata) return outputBytes
  if (format !== 'jpeg') return outputBytes
  if (sourceBytes[0] !== 0xff || sourceBytes[1] !== 0xd8) return outputBytes
  try {
    return transferExifToJpeg(sourceBytes, outputBytes)
  } catch {
    return outputBytes
  }
}

interface InputFile {
  path: string
  name: string
}

type ImageOperation = (
  file: InputFile,
  options: Record<string, unknown>,
  onProgress: ((percent: number, message?: string) => void) | undefined,
  signal: AbortSignal,
  workDir: string,
) => Promise<{ filename: string; data: Uint8Array | ArrayBuffer | Buffer }>

async function runImageBatch(
  ctx: EngineContext,
  files: InputFile[],
  options: Record<string, unknown>,
  run: ImageOperation,
  suffix = 'converted',
): Promise<EngineResult> {
  const first = files[0]!
  if (files.length === 1) {
    const result = await run(first, options, undefined, ctx.signal, ctx.workDir)
    return writeOutput(ctx, result.filename, result.data)
  }

  const existingNames = new Set<string>()
  const entries: Array<{ name: string; data: Uint8Array | ArrayBuffer | Buffer }> = []
  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < files.length; i++) {
    checkAbort(ctx.signal)
    ctx.onProgress((((i + 1) / files.length) * 90), `Processing ${files[i]!.name}…`, {
      index: i + 1,
      total: files.length,
    })
    const file = files[i]!
    try {
      const result = await run(file, options, undefined, ctx.signal, ctx.workDir)
      checkAbort(ctx.signal)
      const name = resolveCollision(result.filename, existingNames)
      existingNames.add(name)
      entries.push({ name, data: result.data })
    } catch (err) {
      if (ctx.signal.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (entries.length === 0) {
    throw new BatchError(`Could not process any of the ${files.length} files. ${failed[0]?.error ?? ''}`.trim(), {
      failedFiles: failed,
    })
  }
  if (failed.length > 0) {
    throw new BatchError(
      `${entries.length} of ${files.length} files were processed, but ${failed.length} could not be processed and were skipped.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }

  ctx.onProgress(95, 'Writing ZIP…')
  checkAbort(ctx.signal)
  const result = await writeZipArchive(ctx, entries, first.name, suffix)
  ctx.onProgress(100, 'Done')
  return result
}

const convertOne: ImageOperation = async (file, options, _onProgress, signal, workDir) => {
  const format = toImageFormat(options.format, 'jpeg')
  const quality = coerceQuality(options.quality, 85)
  const strip = options.stripMetadata !== false

  checkAbort(signal)
  const buf = await fsp.readFile(file.path)
  checkAbort(signal)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const source = await loadImage(bytes)
  checkAbort(signal)

  let output = await render(source, {
    format,
    quality,
    fit: 'contain',
    background: transparencyBackground(file.name, format),
  })
  output = Buffer.from(await applyMetadataPolicy(bytes, output, format, strip))
  checkAbort(signal)
  void workDir

  return {
    data: output,
    filename: generateOutputName(file.name, format === 'jpeg' ? 'jpg' : format, EXT_MAP[format]),
  }
}

export async function convertImage(
  ctx: EngineContext,
  files: InputFile[],
  options: Record<string, unknown>,
): Promise<EngineResult> {
  return runImageBatch(ctx, files, options, convertOne, 'converted')
}

const compressOne: ImageOperation = async (file, options, _onProgress, signal, workDir) => {
  const originalExt = getFileExtension(file.name)
  const format = FORMAT_BY_EXT[originalExt] ?? 'jpeg'
  const quality = coerceQuality(options.quality, 80)
  const maxDimension = coerceDimension(options.maxDimension)
  const strip = options.stripMetadata !== false

  checkAbort(signal)
  const buf = await fsp.readFile(file.path)
  checkAbort(signal)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const source = await loadImage(bytes)
  checkAbort(signal)

  let maxWidth: number | undefined
  let maxHeight: number | undefined
  if (maxDimension) {
    const scale = Math.min(maxDimension / source.width, maxDimension / source.height)
    if (scale < 1) {
      maxWidth = Math.max(1, Math.round(source.width * scale))
      maxHeight = Math.max(1, Math.round(source.height * scale))
    }
  }

  let output = await render(source, {
    format,
    quality,
    fit: 'contain',
    maxWidth,
    maxHeight,
    background: transparencyBackground(file.name, format),
  })
  output = Buffer.from(await applyMetadataPolicy(bytes, output, format, strip))
  checkAbort(signal)
  void workDir

  return {
    data: output,
    filename: generateOutputName(file.name, 'compressed', EXT_MAP[format]),
  }
}

export async function compressImage(
  ctx: EngineContext,
  files: InputFile[],
  options: Record<string, unknown>,
): Promise<EngineResult> {
  return runImageBatch(ctx, files, options, compressOne, 'compressed')
}

const resizeOne: ImageOperation = async (file, options, _onProgress, signal, workDir) => {
  const width = coerceDimension(options.width)
  const height = coerceDimension(options.height)
  const fit = (options.fit as 'contain' | 'cover' | 'stretch') ?? 'contain'
  const quality = coerceQuality(options.quality, 90)
  const strip = options.stripMetadata !== false

  checkAbort(signal)
  const buf = await fsp.readFile(file.path)
  checkAbort(signal)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const source = await loadImage(bytes)
  checkAbort(signal)

  const srcW = source.width
  const srcH = source.height
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

  let output = await render(source, {
    format,
    quality,
    fit,
    maxWidth: targetW,
    maxHeight: targetH,
    background: transparencyBackground(file.name, format),
  })
  output = Buffer.from(await applyMetadataPolicy(bytes, output, format, strip))
  checkAbort(signal)
  void workDir

  return {
    data: output,
    filename: generateOutputName(file.name, 'resized', EXT_MAP[format]),
  }
}

export async function resizeImage(
  ctx: EngineContext,
  files: InputFile[],
  options: Record<string, unknown>,
): Promise<EngineResult> {
  return runImageBatch(ctx, files, options, resizeOne, 'resized')
}

export async function cropImage(
  ctx: EngineContext,
  files: InputFile[],
  options: Record<string, unknown>,
): Promise<EngineFileResult> {
  const file = files[0]!
  const format = toImageFormat(options.format, 'jpeg')
  const quality = coerceQuality(options.quality, 90)
  const rotation = coerceRotation(options.rotation)
  const strip = options.stripMetadata !== false

  checkAbort(ctx.signal)
  const buf = await fsp.readFile(file.path)
  checkAbort(ctx.signal)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const source = await loadImage(bytes)
  checkAbort(ctx.signal)

  const crop = coerceCrop(options.crop, source.width, source.height)

  let output = await render(source, {
    format,
    quality,
    fit: 'contain',
    crop,
    rotation,
    background: transparencyBackground(file.name, format),
  })
  output = Buffer.from(await applyMetadataPolicy(bytes, output, format, strip))
  checkAbort(ctx.signal)

  return writeOutput(ctx, generateOutputName(file.name, 'cropped', EXT_MAP[format]), output)
}