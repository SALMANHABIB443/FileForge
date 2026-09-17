import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { makeHarness, writeFixture, asFile } from '../test-util'
import type { EngineFileResult } from '../types'
import { pdfToImages } from './pdf-to-images'

async function makePdf(pageCount: number, text = 'hello'): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([200, 200])
    const font = await doc.embedFont('Helvetica')
    page.drawText(`${text} page ${i + 1}`, { x: 50, y: 100, font, size: 14 })
  }
  return doc.save()
}

describe('pdf-to-images engine', () => {
  it('renders a single-page pdf to an image', async () => {
    const harness = await makeHarness()
    try {
      const bytes = await makePdf(1)
      const file = await writeFixture(harness.dir, 'single.pdf', bytes)
      const result = asFile(
        await pdfToImages(harness.ctx, [{ path: file.path, name: file.name }], { format: 'png', scale: 1 }),
      ) as EngineFileResult
      expect(result.filename).toMatch(/^single_page_1\.(png|jpg)$/)
      expect(result.outputSize).toBeGreaterThan(0)
    } finally {
      await harness.cleanup()
    }
  })

  it('honors the jpeg format and a page range', async () => {
    const harness = await makeHarness()
    try {
      const bytes = await makePdf(3)
      const file = await writeFixture(harness.dir, 'multi.pdf', bytes)
      const result = asFile(await pdfToImages(harness.ctx, [{ path: file.path, name: file.name }], { format: 'jpeg', range: '2' }))
      expect(result.filename).toMatch(/^multi_page_2\.(jpg|jpeg)$/)
    } finally {
      await harness.cleanup()
    }
  })

  it('packages multiple pages into a zip', async () => {
    const harness = await makeHarness()
    try {
      const bytes = await makePdf(3)
      const file = await writeFixture(harness.dir, 'z.pdf', bytes)
      const result = asFile(await pdfToImages(harness.ctx, [{ path: file.path, name: file.name }], { format: 'png', scale: 1 }))
      expect(result.filename).toMatch(/^z_pages\.zip$/)
    } finally {
      await harness.cleanup()
    }
  })

  it('rejects invalid page ranges', async () => {
    const harness = await makeHarness()
    try {
      const bytes = await makePdf(2)
      const file = await writeFixture(harness.dir, 'r.pdf', bytes)
      await expect(pdfToImages(harness.ctx, [{ path: file.path, name: file.name }], { range: 'nonsense' })).rejects.toThrow()
    } finally {
      await harness.cleanup()
    }
  })

  it('stops when the signal is already aborted', async () => {
    const harness = await makeHarness()
    try {
      const bytes = await makePdf(1)
      const file = await writeFixture(harness.dir, 'a.pdf', bytes)
      const controller = new AbortController()
      controller.abort()
      await expect(
        pdfToImages({ ...harness.ctx, signal: controller.signal }, [{ path: file.path, name: file.name }], {}),
      ).rejects.toThrow(/cancelled/i)
    } finally {
      await harness.cleanup()
    }
  })

  it('rejects when the input is not a pdf', async () => {
    const harness = await makeHarness()
    try {
      const file = await writeFixture(harness.dir, 'fake.pdf', 'not a pdf')
      await expect(pdfToImages(harness.ctx, [{ path: file.path, name: file.name }], {})).rejects.toThrow()
    } finally {
      await harness.cleanup()
    }
  })
})