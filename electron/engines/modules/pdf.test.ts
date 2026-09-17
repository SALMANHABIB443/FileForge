import fsp from 'node:fs/promises'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  coerceRotation,
  compressPdf,
  imagesToPdf,
  mergePdfs,
  organizePdf,
  parseRanges,
  pdfPageCountForRange,
  splitPdf,
} from './pdf'
import { makeHarness, writeFixture, asFile } from '../test-util'

function pngBytes(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#336699'
  ctx.fillRect(0, 0, width, height)
  return canvas.toBuffer('image/png')
}

async function makePdf(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([200, 100 * (i + 1)])
    page.drawText(`page ${i + 1}`, { x: 20, y: 40, size: 12 })
  }
  return pdf.save()
}

describe('modules/pdf', () => {
  it('parses page ranges', () => {
    expect(parseRanges('1-3, 5, 8-10', 10)).toEqual([1, 2, 3, 5, 8, 9, 10])
    expect(parseRanges('3', 3)).toEqual([3])
    expect(() => parseRanges('', 5)).toThrow(/Enter a page range/)
    expect(() => parseRanges('0-2', 5)).toThrow(/outside the document/)
    expect(() => parseRanges('4-2', 5)).toThrow(/outside the document/)
    expect(() => parseRanges('9', 5)).toThrow(/outside the document/)
    expect(() => parseRanges('x', 5)).toThrow(/Invalid range/)
  })

  it('coerces rotation values', () => {
    expect(coerceRotation(90)).toBe(90)
    expect(coerceRotation(180)).toBe(180)
    expect(coerceRotation(270)).toBe(270)
    expect(coerceRotation(45)).toBe(0)
    expect(coerceRotation(undefined)).toBe(0)
  })

  it('builds a PDF from images', async () => {
    const h = await makeHarness()
    try {
      const png = await writeFixture(h.dir, 'a.png', pngBytes(64, 48))
      const jpg = await writeFixture(h.dir, 'b.jpg', createCanvas(32, 32).toBuffer('image/jpeg'))
      const result = asFile(await imagesToPdf([png, jpg], { pageSize: 'fit' }, h.ctx))
      const doc = await PDFDocument.load(await fsp.readFile(result.outputPath))
      expect(doc.getPageCount()).toBe(2)
    } finally {
      await h.cleanup()
    }
  })

  it('rejects unsupported image types for PDF building', async () => {
    const h = await makeHarness()
    try {
      const gif = await writeFixture(h.dir, 'a.gif', Buffer.from([0x47, 0x49, 0x46, 0x38]))
      await expect(imagesToPdf([gif], {}, h.ctx)).rejects.toThrow(/Unsupported image type/)
    } finally {
      await h.cleanup()
    }
  })

  it('merges multiple PDFs', async () => {
    const h = await makeHarness()
    try {
      const a = await writeFixture(h.dir, 'a.pdf', await makePdf(1))
      const b = await writeFixture(h.dir, 'b.pdf', await makePdf(2))
      const result = asFile(await mergePdfs([a, b], {}, h.ctx))
      const doc = await PDFDocument.load(await fsp.readFile(result.outputPath))
      expect(doc.getPageCount()).toBe(3)
    } finally {
      await h.cleanup()
    }
  })

  it('requires at least two PDFs to merge', async () => {
    const h = await makeHarness()
    try {
      const a = await writeFixture(h.dir, 'a.pdf', await makePdf(1))
      await expect(mergePdfs([a], {}, h.ctx)).rejects.toThrow(/at least two PDFs/)
    } finally {
      await h.cleanup()
    }
  })

  it('splits pages by range and by page', async () => {
    const h = await makeHarness()
    try {
      const pdf = await writeFixture(h.dir, 'doc.pdf', await makePdf(3))

      const ranged = asFile(await splitPdf([pdf], { mode: 'range', range: '2-3' }, h.ctx))
      expect(ranged.outputPath.endsWith('.pdf')).toBe(true)
      const doc = await PDFDocument.load(await fsp.readFile(ranged.outputPath))
      expect(doc.getPageCount()).toBe(2)

      const every = asFile(await splitPdf([pdf], { mode: 'every' }, h.ctx))
      expect(every.outputPath.endsWith('.zip')).toBe(true)
      const zipBytes = await fsp.readFile(every.outputPath)
      expect(zipBytes.subarray(0, 2).toString()).toBe('PK')
    } finally {
      await h.cleanup()
    }
  })

  it('rejects corrupted PDF files', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'broken.pdf', Buffer.from('this is not a pdf'))
      await expect(compressPdf([file], {}, h.ctx)).rejects.toThrow(/not a valid PDF/)
    } finally {
      await h.cleanup()
    }
  })

  it('compresses a PDF', async () => {
    const h = await makeHarness()
    try {
      const pdf = await writeFixture(h.dir, 'doc.pdf', await makePdf(3))
      const result = asFile(await compressPdf([pdf], {}, h.ctx))
      const doc = await PDFDocument.load(await fsp.readFile(result.outputPath))
      expect(doc.getPageCount()).toBe(3)
    } finally {
      await h.cleanup()
    }
  })

  it('organizes and rotates pages', async () => {
    const h = await makeHarness()
    try {
      const pdf = await writeFixture(h.dir, 'doc.pdf', await makePdf(3))
      const result = asFile(await organizePdf([pdf], { order: [2, 0, 1], rotation: 90 }, h.ctx))
      const doc = await PDFDocument.load(await fsp.readFile(result.outputPath))
      expect(doc.getPageCount()).toBe(3)
      expect(doc.getPages()[0]!.getRotation().angle).toBe(90)
    } finally {
      await h.cleanup()
    }
  })

  it('counts PDF pages', async () => {
    const bytes = await makePdf(3)
    expect(await pdfPageCountForRange(bytes)).toBe(3)
  })

  it('writes outputs inside the work dir', async () => {
    const h = await makeHarness()
    try {
      const pdf = await writeFixture(h.dir, 'doc.pdf', await makePdf(1))
      const result = asFile(await compressPdf([pdf], {}, h.ctx))
      expect(path.dirname(result.outputPath)).toBe(h.ctx.workDir)
    } finally {
      await h.cleanup()
    }
  })
})