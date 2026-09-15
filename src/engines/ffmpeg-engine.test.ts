import { describe, it, expect } from 'vitest'
import {
  buildExtractAudioArgs,
  buildConvertAudioArgs,
  buildCompressVideoArgs,
  mimeForOutput,
  VIDEO_RESOLUTIONS,
} from '@/engines/ffmpeg-engine'
import {
  getMediaFileWarnings,
  assertMediaSizeAllowed,
  SOFT_WARN_BYTES,
  HARD_LIMIT_BYTES,
} from '@/utils/media'

describe('buildExtractAudioArgs', () => {
  it('extracts MP3 with default 192 kbps bitrate', () => {
    expect(buildExtractAudioArgs('input_0.mp4', 'output.mp3', {}))
      .toEqual(['-i', 'input_0.mp4', '-vn', '-sn', '-dn', '-c:a', 'libmp3lame', '-b:a', '192k', 'output.mp3'])
  })

  it('extracts WAV without a bitrate flag', () => {
    expect(buildExtractAudioArgs('input_0.webm', 'output.wav', { format: 'wav' }))
      .toEqual(['-i', 'input_0.webm', '-vn', '-sn', '-dn', '-c:a', 'pcm_s16le', 'output.wav'])
  })

  it('honours a custom bitrate', () => {
    const args = buildExtractAudioArgs('input_0.mov', 'output.mp3', { format: 'mp3', bitrate: 320 })
    expect(args).toContain('320k')
  })

  it('falls back to MP3 for unknown formats', () => {
    const args = buildExtractAudioArgs('a.mp4', 'b.mp3', { format: 'ogg' })
    expect(args).toContain('libmp3lame')
  })
})

describe('buildConvertAudioArgs', () => {
  it('converts to M4A with AAC codec and bitrate', () => {
    expect(buildConvertAudioArgs('input_0.mp3', 'output.m4a', { format: 'm4a', bitrate: 256 }))
      .toEqual(['-i', 'input_0.mp3', '-c:a', 'aac', '-b:a', '256k', 'output.m4a'])
  })

  it('converts to WAV without a bitrate flag', () => {
    expect(buildConvertAudioArgs('input_0.mp3', 'output.wav', { format: 'wav' }))
      .toEqual(['-i', 'input_0.mp3', '-c:a', 'pcm_s16le', 'output.wav'])
  })

  it('defaults to MP3 192 kbps', () => {
    const args = buildConvertAudioArgs('input_0.wav', 'output.mp3', {})
    expect(args).toContain('libmp3lame')
    expect(args).toContain('192k')
  })
})

describe('buildCompressVideoArgs', () => {
  it('defaults to CRF 28 and 128 kbps audio with no scaling', () => {
    const args = buildCompressVideoArgs('input_0.mp4', 'output.mp4', {})
    expect(args).toContain('-crf')
    expect(args).toContain('28')
    expect(args).toContain('128k')
    expect(args).not.toContain('-vf')
  })

  it('adds scale filter for 720p', () => {
    const args = buildCompressVideoArgs('input_0.mp4', 'output.mp4', { resolution: '720' })
    expect(args).toContain('-vf')
    expect(args).toContain('scale=-2:720')
  })

  it('treats unknown resolution as original (no scaling)', () => {
    const args = buildCompressVideoArgs('input_0.mp4', 'output.mp4', { resolution: '4k' })
    expect(args).not.toContain('-vf')
  })

  it('supports every defined resolution preset', () => {
    for (const preset of Object.keys(VIDEO_RESOLUTIONS)) {
      const args = buildCompressVideoArgs('input_0.mp4', 'output.mp4', { resolution: preset })
      expect(args).toBeDefined()
    }
  })
})

describe('mimeForOutput', () => {
  it('returns the right MIME type per extension', () => {
    expect(mimeForOutput('mp3')).toBe('audio/mpeg')
    expect(mimeForOutput('wav')).toBe('audio/wav')
    expect(mimeForOutput('m4a')).toBe('audio/mp4')
    expect(mimeForOutput('mp4')).toBe('video/mp4')
    expect(mimeForOutput('unknown')).toBe('application/octet-stream')
  })
})

describe('media size limits', () => {
  it('returns no warning for small files', () => {
    expect(getMediaFileWarnings(1024)).toBeNull()
  })

  it('warns for files larger than the soft limit', () => {
    expect(getMediaFileWarnings(SOFT_WARN_BYTES + 1)).toMatch(/large file/i)
  })

  it('blocks files above the hard limit', () => {
    expect(getMediaFileWarnings(HARD_LIMIT_BYTES + 1)).toMatch(/supported limit/i)
  })

  it('allows files under the hard limit', () => {
    expect(() => assertMediaSizeAllowed(HARD_LIMIT_BYTES - 1)).not.toThrow()
  })

  it('rejects files over the hard limit', () => {
    expect(() => assertMediaSizeAllowed(HARD_LIMIT_BYTES + 1)).toThrow(/supported limit/i)
  })

  it('rejects empty or invalid sizes', () => {
    expect(() => assertMediaSizeAllowed(0)).toThrow(/empty or corrupted/i)
    expect(() => assertMediaSizeAllowed(Number.NaN)).toThrow(/empty or corrupted/i)
  })
})