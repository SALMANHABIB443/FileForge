import fsp from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractTar } from './tar'
import { buildTar, makeHarness, writeFixture, asFile } from '../test-util'

describe('modules/tar', () => {
  const archive = buildTar([
    { name: 'notes/a.txt', data: Buffer.from('alpha') },
    { name: 'b.txt', data: Buffer.from('beta') },
  ])

  it('rejects non-tar input', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'x.zip', Buffer.from('nope'))
      await expect(extractTar([file], {}, h.ctx)).rejects.toThrow(/Select a TAR file/)
    } finally {
      await h.cleanup()
    }
  })

  it('re-packages a tar as a zip', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'bundle.tar', archive)
      const result = asFile(await extractTar([file], {}, h.ctx))
      expect(result.outputPath.endsWith('.zip')).toBe(true)
    } finally {
      await h.cleanup()
    }
  })

  it('extracts into a chosen folder and returns a report', async () => {
    const h = await makeHarness()
    try {
      const outDir = path.join(h.dir, 'outdir')
      const file = await writeFixture(h.dir, 'bundle.tar', archive)
      const result = asFile(await extractTar([file], { outputDir: outDir }, h.ctx))
      expect(result.outputPath.endsWith('.txt')).toBe(true)
      expect(await fsp.readFile(path.join(outDir, 'notes', 'a.txt'), 'utf-8')).toBe('alpha')
      expect(await fsp.readFile(path.join(outDir, 'b.txt'), 'utf-8')).toBe('beta')
    } finally {
      await h.cleanup()
    }
  })

  it('skips unsafe paths by re-packaging', async () => {
    const h = await makeHarness()
    try {
      const evil = buildTar([
        { name: '../evil.txt', data: Buffer.from('nope') },
        { name: 'ok.txt', data: Buffer.from('yes') },
      ])
      const file = await writeFixture(h.dir, 'bundle.tar', evil)
      const result = asFile(await extractTar([file], {}, h.ctx))
      expect(result.outputPath).toBeTruthy()
    } finally {
      await h.cleanup()
    }
  })

  it('rejects corrupted tar checksums', async () => {
    const h = await makeHarness()
    try {
      const bad = Buffer.from(archive)
      bad[0] = 0x58
      const file = await writeFixture(h.dir, 'bad.tar', bad)
      await expect(extractTar([file], {}, h.ctx)).rejects.toThrow(/checksum/)
    } finally {
      await h.cleanup()
    }
  })
})