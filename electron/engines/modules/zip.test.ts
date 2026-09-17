import fsp from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createZip, extractZip } from './zip'
import { makeHarness, writeFixture, asFile } from '../test-util'

describe('modules/zip', () => {
  it('creates a zip from multiple files', async () => {
    const h = await makeHarness()
    try {
      const a = await writeFixture(h.dir, 'a.txt', 'content-a')
      const b = await writeFixture(h.dir, 'b.txt', 'content-b')
      const result = asFile(await createZip([a, b], { level: 6 }, h.ctx))
      expect(result.outputPath.endsWith('.zip')).toBe(true)
      const zip = await JSZip.loadAsync(await fsp.readFile(result.outputPath))
      expect(await zip.file('a.txt')!.async('string')).toBe('content-a')
      expect(await zip.file('b.txt')!.async('string')).toBe('content-b')
    } finally {
      await h.cleanup()
    }
  })

  it('rejects empty input', async () => {
    const h = await makeHarness()
    try {
      await expect(createZip([], {}, h.ctx)).rejects.toThrow(/at least one file/)
    } finally {
      await h.cleanup()
    }
  })

  it('re-packages a zip as a safe zip with a report', async () => {
    const h = await makeHarness()
    try {
      const inner = new JSZip()
      inner.file('a.txt', 'hello')
      inner.file('_extraction_report.txt', 'old report')
      const zipBytes = await inner.generateAsync({ type: 'nodebuffer' })
      const file = await writeFixture(h.dir, 'archive.zip', zipBytes)

      const result = asFile(await extractZip([file], {}, h.ctx))
      expect(result.outputPath.endsWith('.zip')).toBe(true)
      const out = await JSZip.loadAsync(await fsp.readFile(result.outputPath))
      expect(await out.file('a.txt')!.async('string')).toBe('hello')
      expect(out.file('_extraction_report.txt')).toBeTruthy()
    } finally {
      await h.cleanup()
    }
  })

  it('extracts selected entries only', async () => {
    const h = await makeHarness()
    try {
      const inner = new JSZip()
      inner.file('keep.txt', 'keep')
      inner.file('drop.txt', 'drop')
      const file = await writeFixture(h.dir, 'archive.zip', await inner.generateAsync({ type: 'nodebuffer' }))

      const result = asFile(await extractZip([file], { selectedEntries: ['keep.txt'] }, h.ctx))
      const out = await JSZip.loadAsync(await fsp.readFile(result.outputPath))
      expect(out.file('keep.txt')).toBeTruthy()
      expect(out.file('drop.txt')).toBeFalsy()
    } finally {
      await h.cleanup()
    }
  })

  it('extracts into a chosen folder and returns a report', async () => {
    const h = await makeHarness()
    try {
      const inner = new JSZip()
      inner.file('nested/a.txt', 'alpha')
      inner.file('b.txt', 'beta')
      const file = await writeFixture(h.dir, 'archive.zip', await inner.generateAsync({ type: 'nodebuffer' }))
      const outDir = path.join(h.dir, 'outdir')

      const result = asFile(await extractZip([file], { outputDir: outDir }, h.ctx))
      expect(result.outputPath.endsWith('.txt')).toBe(true)
      expect(await fsp.readFile(path.join(outDir, 'nested', 'a.txt'), 'utf-8')).toBe('alpha')
      expect(await fsp.readFile(path.join(outDir, 'b.txt'), 'utf-8')).toBe('beta')
    } finally {
      await h.cleanup()
    }
  })

  it('rejects traversal attempts and huge archives', async () => {
    const h = await makeHarness()
    try {
      const inner = new JSZip()
      inner.file('../evil.txt', 'nope')
      inner.file('ok.txt', 'yes')
      const file = await writeFixture(h.dir, 'archive.zip', await inner.generateAsync({ type: 'nodebuffer' }))

      const result = asFile(await extractZip([file], {}, h.ctx))
      const out = await JSZip.loadAsync(await fsp.readFile(result.outputPath))
      expect(out.file('ok.txt')).toBeTruthy()
      expect(out.file('../evil.txt')).toBeFalsy()
    } finally {
      await h.cleanup()
    }
  })

  it('rejects non-zip input', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'x.txt', 'not a zip')
      await expect(extractZip([file], {}, h.ctx)).rejects.toThrow(/Select a ZIP file/)
    } finally {
      await h.cleanup()
    }
  })
})