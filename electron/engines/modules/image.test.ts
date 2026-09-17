import fsp from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { compressImage, convertImage, cropImage, resizeImage } from './image'
import { makeHarness, writeFixture, asFile } from '../test-util'

function pngBytes(width: number, height: number, fill = '#cc6633'): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, width, height)
  return canvas.toBuffer('image/png')
}

async function decode(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const img = await loadImage(Buffer.from(bytes))
  return { width: img.width, height: img.height }
}

describe('modules/image', () => {
  it('converts a png to jpeg', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'photo.png', pngBytes(64, 48))
      const result = asFile(await convertImage(h.ctx, [file], { format: 'jpeg', quality: 85, stripMetadata: true }))
      expect(result.outputPath.endsWith('.jpg')).toBe(true)
      expect((await fsp.readFile(result.outputPath)).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
      const dims = await decode(await fsp.readFile(result.outputPath))
      expect(dims).toEqual({ width: 64, height: 48 })
    } finally {
      await h.cleanup()
    }
  })

  it('resizes preserving aspect ratio', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'photo.png', pngBytes(64, 48))
      const result = asFile(await resizeImage(h.ctx, [file], { width: 32, maintainAspect: true }))
      const dims = await decode(await fsp.readFile(result.outputPath))
      expect(dims).toEqual({ width: 32, height: 24 })
    } finally {
      await h.cleanup()
    }
  })

  it('crops an image to the requested region', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'photo.png', pngBytes(80, 60))
      const result = asFile(await cropImage(h.ctx, [file], {
        crop: { x: 10, y: 10, width: 20, height: 20 },
        format: 'png',
        stripMetadata: true,
      }))
      const dims = await decode(await fsp.readFile(result.outputPath))
      expect(dims).toEqual({ width: 20, height: 20 })
    } finally {
      await h.cleanup()
    }
  })

  it('compresses an image', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'photo.png', pngBytes(200, 200))
      const result = asFile(await compressImage(h.ctx, [file], { quality: 25, stripMetadata: true }))
      expect((await fsp.stat(result.outputPath)).size).toBeGreaterThan(0)
      const dims = await decode(await fsp.readFile(result.outputPath))
      expect(dims).toEqual({ width: 200, height: 200 })
    } finally {
      await h.cleanup()
    }
  })

  it('batches multiple images into a zip', async () => {
    const h = await makeHarness()
    try {
      const a = await writeFixture(h.dir, 'a.jpg', createCanvas(32, 32).toBuffer('image/jpeg'))
      const b = await writeFixture(h.dir, 'b.jpg', createCanvas(32, 32).toBuffer('image/jpeg'))
      const result = asFile(await convertImage(h.ctx, [a, b], { format: 'png', stripMetadata: true }))
      expect(result.outputPath.endsWith('.zip')).toBe(true)
      expect((await fsp.readFile(result.outputPath)).subarray(0, 2).toString()).toBe('PK')
    } finally {
      await h.cleanup()
    }
  })
})