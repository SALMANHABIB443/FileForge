import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { extractExifSegment, injectExifSegment, transferExifToJpeg, readImageMetadata } from './exif'

function seg(text = 'abc'): Buffer {
  const content = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), Buffer.from(text, 'binary')])
  return Buffer.concat([Buffer.from([0xff, 0xe1, (content.length + 2) >> 8, (content.length + 2) & 0xff]), content])
}

describe('exif segment helpers', () => {
  it('finds an Exif APP1 segment in a jpeg', () => {
    const extracted = extractExifSegment(Buffer.concat([Buffer.from([0xff, 0xd8]), seg('lens=50mm')]))
    expect(extracted).not.toBeNull()
    expect(extracted![4]).toBe(0x45)
    expect(extracted![5]).toBe(0x78)
  })

  it('returns null for files without an Exif segment', () => {
    expect(extractExifSegment(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull()
    expect(extractExifSegment(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
  })

  it('injects a segment right after the SOI marker', () => {
    const injected = injectExifSegment(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), seg())
    expect(injected[0]).toBe(0xff)
    expect(injected[1]).toBe(0xd8)
    expect(Array.from(injected.subarray(2, 10))).toEqual(Array.from(seg().subarray(0, 8)))
    expect(injected.length).toBe(2 + seg().length + 2)
  })

  it('leaves non-jpeg output untouched when injecting', () => {
    const out = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    expect(injectExifSegment(out, seg())).toBe(out)
  })

  it('transfers an Exif segment from source to jpeg output', () => {
    const source = Buffer.concat([Buffer.from([0xff, 0xd8]), seg('src'), Buffer.from([0xff, 0xd9])])
    const output = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xd9])])
    const result = transferExifToJpeg(source, output)
    expect(Array.from(result.subarray(6, 12))).toEqual(Array.from(Buffer.from('Exif\0\0', 'binary')))
  })

  it('returns output unchanged when source has no Exif', () => {
    const source = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    const output = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    expect(transferExifToJpeg(source, output)).toEqual(output)
  })

  it('readImageMetadata returns a metadata object', async () => {
    const canvas = createCanvas(4, 4)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 4, 4)
    const meta = await readImageMetadata(canvas.toBuffer('image/jpeg'))
    expect(meta).toBeTypeOf('object')
  })
})