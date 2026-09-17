import { spawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { checkAbort, sanitizeFilename } from '../util/common'
import { assertMediaSizeAllowed } from '../util/common'
import type { EngineContext, EngineFileResult, EngineResult } from '../types'

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

export const AUDIO_CODECS: Record<AudioFormat, string> = {
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

const DURATION_RE = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/

async function probeDuration(binary: string, inputPath: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-hide_banner', '-i', inputPath, '-f', 'null', '-'], {
      windowsHide: true,
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      const m = DURATION_RE.exec(stderr)
      if (m) {
        const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 100
        resolve(secs)
      } else {
        resolve(null)
      }
      void code
    })
  })
}

function exec(
  binary: string,
  args: string[],
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<{ code: number; logs: string[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true })
    let logs: string[] = []

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      logs = logs.concat(text.split('\n').map((l) => l.trim()).filter(Boolean))
    })

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      for (const line of text.split('\n')) {
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        if (key === 'out_time_ms') {
          const ms = Number(line.slice(eq + 1).trim())
          if (Number.isFinite(ms)) onProgress(ms / 1000000)
        } else if (key === 'progress' && line.slice(eq + 1).trim() === 'end') {
          onProgress(1)
        }
      }
    })

    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, logs })
    })

    const onAbort = () => {
      child.kill('SIGKILL')
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function executeConversion(
  ctx: EngineContext,
  input: { path: string; name: string; size: number },
  _options: Record<string, unknown>,
  binary: string,
  buildArgs: (inputName: string, outputName: string) => string[],
  outputExt: string,
  suffix: string,
  kind: ConversionKind,
): Promise<EngineResult> {
  assertMediaSizeAllowed(input.size)
  checkAbort(ctx.signal)

  ctx.onProgress(0, 'Loading media engine…')
  checkAbort(ctx.signal)

  const inputPath = input.path
  const outputName = `${input.name.replace(/\.[^.]+$/, '')}_${suffix}.${outputExt}`
  const outputPath = path.join(ctx.workDir, sanitizeFilename(outputName))

  ctx.onProgress(1, 'Reading file metadata…')
  const duration = await probeDuration(binary, inputPath)
  checkAbort(ctx.signal)

  const args = buildArgs(inputPath, outputPath)

  ctx.onProgress(2, 'Converting…')
  const { code, logs } = await exec(binary, args, ctx.signal, (p) => {
    const label = kind === 'video' ? 'Compressing video…' : 'Converting audio…'
    const pct = duration && duration > 0 ? Math.max(0, Math.min(1, p)) : undefined
    if (pct !== undefined) {
      ctx.onProgress(2 + pct * 96, label)
    }
  })

  if (ctx.signal.aborted) {
    throw new DOMException('Operation cancelled', 'AbortError')
  }
  if (code !== 0) {
    throw mapMediaError(kind, logs)
  }

  const stat = await fsp.stat(outputPath)
  if (stat.size === 0) {
    throw mapMediaError(kind, logs)
  }

  ctx.onProgress(100, 'Done')

  const result: EngineFileResult = {
    kind: 'file',
    filename: outputName,
    outputPath,
    outputSize: stat.size,
  }
  return result
}

export async function extractAudio(
  ctx: EngineContext,
  inputs: Array<{ path: string; name: string; size: number }>,
  options: Record<string, unknown>,
  binary: string,
): Promise<EngineResult> {
  return executeConversion(
    ctx,
    inputs[0]!,
    options,
    binary,
    (inName, outName) => buildExtractAudioArgs(inName, outName, options),
    toAudioFormat(options.format),
    'audio',
    'audio-extract',
  )
}

export async function convertAudio(
  ctx: EngineContext,
  inputs: Array<{ path: string; name: string; size: number }>,
  options: Record<string, unknown>,
  binary: string,
): Promise<EngineResult> {
  return executeConversion(
    ctx,
    inputs[0]!,
    options,
    binary,
    (inName, outName) => buildConvertAudioArgs(inName, outName, options),
    toAudioFormat(options.format),
    'converted',
    'audio-convert',
  )
}

export async function compressVideo(
  ctx: EngineContext,
  inputs: Array<{ path: string; name: string; size: number }>,
  options: Record<string, unknown>,
  binary: string,
): Promise<EngineResult> {
  return executeConversion(
    ctx,
    inputs[0]!,
    options,
    binary,
    (inName, outName) => buildCompressVideoArgs(inName, outName, options),
    'mp4',
    'compressed',
    'video',
  )
}