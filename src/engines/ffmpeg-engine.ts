import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { ConversionResult, ProgressCallback } from '@/types/engine'
import type { FileMeta } from '@/types/job'
import { readFileAsBlob } from '@/services/file-service'
import { generateOutputName, getFileExtension } from '@/utils/filename'
import { assertMediaSizeAllowed } from '@/utils/media'

export type AudioFormat = 'mp3' | 'wav' | 'm4a'
export type ConversionKind = 'audio-extract' | 'audio-convert' | 'video'

export interface ExtractAudioOptions {
  format?: string
  bitrate?: number
}

export interface ConvertAudioOptions {
  format?: string
  bitrate?: number
}

export interface CompressVideoOptions {
  resolution?: string
  crf?: number
  audioBitrate?: number
}

const AUDIO_CODECS: Record<AudioFormat, string> = {
  mp3: 'libmp3lame',
  wav: 'pcm_s16le',
  m4a: 'aac',
}

function toAudioFormat(value: unknown): AudioFormat {
  return value === 'wav' || value === 'm4a' ? value : 'mp3'
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
}

export function buildExtractAudioArgs(
  inputName: string,
  outputName: string,
  options: ExtractAudioOptions = {},
): string[] {
  const format = toAudioFormat(options.format)
  const bitrate = toInt(options.bitrate, 192)
  const args = ['-i', inputName, '-vn', '-sn', '-dn']
  if (format === 'wav') {
    args.push('-c:a', AUDIO_CODECS.wav)
  } else {
    args.push('-c:a', AUDIO_CODECS.mp3, '-b:a', `${bitrate}k`)
  }
  args.push(outputName)
  return args
}

export function buildConvertAudioArgs(
  inputName: string,
  outputName: string,
  options: ConvertAudioOptions = {},
): string[] {
  const format = toAudioFormat(options.format)
  const bitrate = toInt(options.bitrate, 192)
  const args = ['-i', inputName, '-c:a', AUDIO_CODECS[format]]
  if (format !== 'wav') {
    args.push('-b:a', `${bitrate}k`)
  }
  args.push(outputName)
  return args
}

export const VIDEO_RESOLUTIONS: Record<string, number | null> = {
  original: null,
  '1080': 1080,
  '720': 720,
  '480': 480,
}

export function buildCompressVideoArgs(
  inputName: string,
  outputName: string,
  options: CompressVideoOptions = {},
): string[] {
  const crf = toInt(options.crf, 28)
  const audioBitrate = toInt(options.audioBitrate, 128)
  const height = VIDEO_RESOLUTIONS[String(options.resolution ?? 'original')] ?? null

  const args = [
    '-i',
    inputName,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(crf),
    '-c:a',
    'aac',
    '-b:a',
    `${audioBitrate}k`,
    '-movflags',
    '+faststart',
  ]
  if (height) {
    args.push('-vf', `scale=-2:${height}`)
  }
  args.push(outputName)
  return args
}

export function mimeForOutput(extension: string): string {
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'm4a':
      return 'audio/mp4'
    case 'mp4':
      return 'video/mp4'
    default:
      return 'application/octet-stream'
  }
}

let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Operation cancelled', 'AbortError')
  }
}

function resetSingleton(): void {
  ffmpegInstance = null
  loadPromise = null
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (!loadPromise) {
    loadPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const base = import.meta.env.BASE_URL || '/'
      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: `${base}ffmpeg/ffmpeg-core.js`,
        wasmURL: `${base}ffmpeg/ffmpeg-core.wasm`,
      })
      ffmpegInstance = ffmpeg
      return ffmpeg
    })()
  }
  return loadPromise
}

function mapMediaError(kind: ConversionKind, logs: string[]): Error {
  const text = logs.join('\n').toLowerCase()
  if (text.includes('does not contain any stream')) {
    return new Error('No audio track was found in this file')
  }
  if (text.includes('unknown encoder') || text.includes('encoder not found')) {
    return new Error('The required encoder is not supported in this version')
  }
  if (kind === 'video') {
    return new Error('Video compression failed. The file may be corrupted or use an unsupported codec.')
  }
  return new Error('Audio conversion failed. The file may be corrupted or use an unsupported codec.')
}

async function executeConversion(
  input: FileMeta,
  buildArgs: (inputName: string, outputName: string) => string[],
  outputExt: string,
  suffix: string,
  kind: ConversionKind,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<ConversionResult> {
  assertMediaSizeAllowed(input.size)
  checkAbort(signal)

  onProgress(0, 'Loading media engine…')
  const ffmpeg = await getFFmpeg()
  checkAbort(signal)

  const ext = getFileExtension(input.name) || 'media'
  const inputName = `input_0.${ext}`
  const outputName = `output.${outputExt}`
  const args = buildArgs(inputName, outputName)

  const progressCb = (event: { progress: number }) => {
    const p = 2 + Math.max(0, Math.min(1, event.progress)) * 96
    onProgress(
      p,
      kind === 'video' ? 'Compressing video…' : 'Converting audio…',
    )
  }

  const logs: string[] = []
  const logCb = (event: { message: string }) => {
    const line = event.message.trim()
    if (line) logs.push(line)
  }

  ffmpeg.on('progress', progressCb)
  ffmpeg.on('log', logCb)

  try {
    onProgress(1, 'Reading file…')
    const blob = await readFileAsBlob(input)
    checkAbort(signal)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    checkAbort(signal)

    await ffmpeg.writeFile(inputName, bytes)
    onProgress(2, 'Converting…')

    const exitCode = await ffmpeg.exec(args, -1, { signal })
    if (signal.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    if (exitCode !== 0) {
      throw mapMediaError(kind, logs)
    }

    const rawOutput = await ffmpeg.readFile(outputName)
    const output = typeof rawOutput === 'string' ? new TextEncoder().encode(rawOutput) : rawOutput
    if (output.byteLength === 0) {
      throw mapMediaError(kind, logs)
    }

    return {
      blob: new Blob([output.buffer as ArrayBuffer], {
        type: mimeForOutput(outputExt),
      }),
      filename: generateOutputName(input.name, suffix, outputExt),
    }
  } catch (err) {
    if (signal.aborted) {
      ffmpeg.terminate()
      resetSingleton()
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    throw err
  } finally {
    ffmpeg.off('progress', progressCb)
    ffmpeg.off('log', logCb)
    if (!signal.aborted) {
      try {
        await ffmpeg.deleteFile(inputName)
        await ffmpeg.deleteFile(outputName)
      } catch {
        // virtual files may already be gone
      }
    }
  }
}

export async function extractAudio(
  inputs: FileMeta[],
  options: ExtractAudioOptions,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<ConversionResult> {
  return executeConversion(
    inputs[0]!,
    (inName, outName) => buildExtractAudioArgs(inName, outName, options),
    toAudioFormat(options.format),
    'audio',
    'audio-extract',
    onProgress,
    signal,
  )
}

export async function convertAudio(
  inputs: FileMeta[],
  options: ConvertAudioOptions,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<ConversionResult> {
  return executeConversion(
    inputs[0]!,
    (inName, outName) => buildConvertAudioArgs(inName, outName, options),
    toAudioFormat(options.format),
    'converted',
    'audio-convert',
    onProgress,
    signal,
  )
}

export async function compressVideo(
  inputs: FileMeta[],
  options: CompressVideoOptions,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<ConversionResult> {
  return executeConversion(
    inputs[0]!,
    (inName, outName) => buildCompressVideoArgs(inName, outName, options),
    'mp4',
    'compressed',
    'video',
    onProgress,
    signal,
  )
}