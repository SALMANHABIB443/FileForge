import fsp from 'node:fs/promises'
import path from 'node:path'
import type { EngineContext, EngineFileResult } from '../types'

export const SOFT_WARN_BYTES = 200 * 1024 * 1024
export const HARD_LIMIT_BYTES = 1024 * 1024 * 1024

export function generateOutputName(
  originalName: string,
  suffix: string,
  extension: string,
): string {
  const base = originalName.replace(/\.[^.]+$/, '')
  return `${base}_${suffix}.${extension}`
}

export function resolveCollision(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name

  const dot = name.lastIndexOf('.')
  const base = dot >= 0 ? name.slice(0, dot) : name
  const ext = dot >= 0 ? name.slice(dot) : ''

  let counter = 1
  let candidate = `${base} (${counter})${ext}`
  while (existingNames.has(candidate)) {
    counter++
    candidate = `${base} (${counter})${ext}`
  }
  return candidate
}

export function sanitizeFilename(name: string): string {
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export interface FailedFileInfo {
  name: string
  error: string
}

/**
 * Error thrown when a batch engine collects per-file failures. Carries
 * human-readable `message`, optional technical `details`, and the list of
 * affected files so the renderer can display them separately.
 */
export class BatchError extends Error {
  readonly failedFiles: FailedFileInfo[]
  readonly details?: string

  constructor(
    message: string,
    options?: { failedFiles?: FailedFileInfo[]; details?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'BatchError'
    this.failedFiles = options?.failedFiles ?? []
    this.details = options?.details
  }
}

export function isBatchError(err: unknown): err is BatchError {
  return err instanceof BatchError
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]! ?? 'TB'}`
}

export function assertMediaSizeAllowed(sizeBytes: number): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('The file appears to be empty or corrupted')
  }
  if (sizeBytes > HARD_LIMIT_BYTES) {
    throw new Error(
      `This file is ${formatFileSize(sizeBytes)} — larger than the supported limit of ${formatFileSize(HARD_LIMIT_BYTES)}. Pick a smaller file.`,
    )
  }
}

export function getMediaFileWarnings(sizeBytes: number): string | null {
  if (sizeBytes > HARD_LIMIT_BYTES) {
    return `This file is ${formatFileSize(sizeBytes)} — larger than the supported limit of ${formatFileSize(HARD_LIMIT_BYTES)}. Pick a smaller file.`
  }
  if (sizeBytes > SOFT_WARN_BYTES) {
    return `This is a large file (${formatFileSize(sizeBytes)}). Conversion runs entirely on your device, so it can take a while and may be slow on low-RAM machines.`
  }
  return null
}

export function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Operation cancelled', 'AbortError')
  }
}

/**
 * Returns a Buffer for `data` (Buffer.ts Buffer / Uint8Array / ArrayBuffer
 * payloads that cross the worker IPC boundary arrive as Uint8Array).
 */
export function toBuffer(data: Uint8Array | ArrayBuffer | Buffer): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
}

export async function writeOutput(
  ctx: EngineContext,
  filename: string,
  data: Uint8Array | ArrayBuffer | Buffer,
): Promise<EngineFileResult> {
  checkAbort(ctx.signal)
  const target = path.join(ctx.workDir, sanitizeFilename(filename))
  await fsp.mkdir(ctx.workDir, { recursive: true })
  const buf = toBuffer(data)
  await fsp.writeFile(target, buf)
  return {
    kind: 'file',
    filename,
    outputPath: target,
    outputSize: buf.byteLength,
  }
}

/**
 * Reads a whole file into a Uint8Array. Batch engines read inputs repeatedly,
 * so keeping this in one place keeps limits consistent.
 */
export async function readInput(ctx: EngineContext, file: { path: string }): Promise<Uint8Array> {
  checkAbort(ctx.signal)
  const buf = await fsp.readFile(file.path)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}