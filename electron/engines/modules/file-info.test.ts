import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { getFileInfo } from './file-info'
import { makeHarness, writeFixture } from '../test-util'

function pngBytes(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#99cc66'
  ctx.fillRect(0, 0, width, height)
  return canvas.toBuffer('image/png')
}

describe('modules/file-info', () => {
  it('reads basic file metadata', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'note.txt', 'hello world')
      const info = await getFileInfo(file, h.ctx)
      expect(info.name).toBe('note.txt')
      expect(info.extension).toBe('txt')
      expect(info.size).toBe(11)
      expect(info.lastModified).toBeGreaterThan(0)
      expect(info.hash).toMatch(/^[0-9a-f]{64}$/)
    } finally {
      await h.cleanup()
    }
  })

  it('reads image dimensions', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'photo.png', pngBytes(64, 48))
      const info = await getFileInfo(file, h.ctx)
      expect(info.type).toBe('image/png')
      expect(info.dimensions).toEqual({ width: 64, height: 48 })
      expect(info.hash).toMatch(/^[0-9a-f]{64}$/)
    } finally {
      await h.cleanup()
    }
  })

  it('exposes mime types by extension', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'clip.mp3', Buffer.from([0xff, 0xfb, 0x90, 0x00]))
      const info = await getFileInfo(file, h.ctx)
      expect(info.type).toBe('audio/mpeg')
    } finally {
      await h.cleanup()
    }
  })
})