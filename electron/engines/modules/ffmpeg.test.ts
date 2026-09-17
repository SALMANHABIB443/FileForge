import { createRequire } from 'node:module'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUDIO_CODECS,
  buildCompressVideoArgs,
  buildConvertAudioArgs,
  buildExtractAudioArgs,
  convertAudio,
  extractAudio,
  mimeForOutput,
} from './ffmpeg'
import { makeHarness, writeFixture, asFile } from '../test-util'

function wavBytes(durationMs: number): Buffer {
  const sampleRate = 8000
  const samples = Math.floor((sampleRate * durationMs) / 1000)
  const dataSize = samples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples; i++) {
    buf.writeInt16LE(Math.round(Math.sin((i / sampleRate) * 440 * Math.PI * 2) * 8000), 44 + i * 2)
  }
  return buf
}

const requireFromMain = createRequire(import.meta.url)

function ffmpegBinary(): string | null {
  try {
    const binary = requireFromMain('ffmpeg-static')
    return typeof binary === 'string' ? binary : null
  } catch {
    return null
  }
}

describe('modules/ffmpeg', () => {
  it('builds audio extraction args', () => {
    const args = buildExtractAudioArgs('in.mp4', 'out.mp3', { format: 'mp3', bitrate: 128 })
    expect(args).toContain('-vn')
    expect(args).toContain('-c:a')
    expect(args).toContain(AUDIO_CODECS.mp3)
    expect(args).toContain('-b:a')
    const wav = buildExtractAudioArgs('in.mp4', 'out.wav', { format: 'wav' })
    expect(wav).toContain(AUDIO_CODECS.wav)
    expect(wav).not.toContain('-b:a')
  })

  it('builds audio convert args', () => {
    const args = buildConvertAudioArgs('in.wav', 'out.m4a', { format: 'm4a' })
    expect(args).toContain(AUDIO_CODECS.m4a)
  })

  it('builds video compress args with scaling', () => {
    const args = buildCompressVideoArgs('in.mp4', 'out.mp4', { crf: 23, audioBitrate: 96, resolution: '720' })
    expect(args).toContain('libx264')
    expect(args).toContain('-vf')
    const original = buildCompressVideoArgs('in.mp4', 'out.mp4', {})
    expect(original).toContain('-crf')
    expect(original).not.toContain('-vf')
  })

  it('maps output extensions to mime types', () => {
    expect(mimeForOutput('mp3')).toBe('audio/mpeg')
    expect(mimeForOutput('wav')).toBe('audio/wav')
    expect(mimeForOutput('m4a')).toBe('audio/mp4')
    expect(mimeForOutput('mp4')).toBe('video/mp4')
    expect(mimeForOutput('weird')).toBe('application/octet-stream')
  })

  it('extracts audio with the real ffmpeg binary', async () => {
    const binary = ffmpegBinary()
    if (!binary) {
      console.warn('ffmpeg-static binary not found — skipping real conversion test')
      return
    }
    const h = await makeHarness()
    try {
      const wav = await writeFixture(h.dir, 'tone.wav', wavBytes(300))
      const result = asFile(await extractAudio(h.ctx, [wav], { format: 'mp3' }, binary))
      expect(result.outputPath.endsWith('.mp3')).toBe(true)
      expect((await fsp.stat(result.outputPath)).size).toBeGreaterThan(1000)
    } finally {
      await h.cleanup()
    }
  }, 30000)

  it('converts wav to m4a with the real ffmpeg binary', async () => {
    const binary = ffmpegBinary()
    if (!binary) return
    const h = await makeHarness()
    try {
      const wav = await writeFixture(h.dir, 'tone.wav', wavBytes(200))
      const result = asFile(await convertAudio(h.ctx, [wav], { format: 'm4a' }, binary))
      expect(result.outputPath.endsWith('.m4a')).toBe(true)
    } finally {
      await h.cleanup()
    }
  }, 30000)

  it('rejects input larger than the hard limit', async () => {
    const binary = ffmpegBinary()
    if (!binary) return
    const h = await makeHarness()
    try {
      const bogus = { path: path.join(h.dir, 'huge.mp4'), name: 'huge.mp4', size: 2 * 1024 * 1024 * 1024 }
      await expect(extractAudio(h.ctx, [bogus], { format: 'mp3' }, binary)).rejects.toThrow(/supported limit/)
    } finally {
      await h.cleanup()
    }
  })
})