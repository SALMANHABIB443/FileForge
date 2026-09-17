import fsp from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { batchRename, computeRenames } from './rename'
import { makeHarness, writeFixture, asFile } from '../test-util'

describe('modules/rename', () => {
  it('computes prefix renames', () => {
    const out = computeRenames([{ name: 'a.txt' }, { name: 'b.txt' }], { mode: 'prefix', prefix: 'draft-' })
    expect(out.map((r) => r.renamed)).toEqual(['draft-a.txt', 'draft-b.txt'])
  })

  it('computes suffix, find-replace and sequential renames', () => {
    expect(computeRenames([{ name: 'a.txt' }], { mode: 'suffix', suffix: '-v2' })[0]!.renamed).toBe('a-v2.txt')
    expect(computeRenames([{ name: 'old-name.txt' }], { mode: 'find-replace', findText: 'old', replaceText: 'new' })[0]!.renamed).toBe('new-name.txt')
    const seq = computeRenames([{ name: 'a.png' }, { name: 'b.png' }], {
      mode: 'sequential',
      startNumber: 5,
      padWidth: 3,
      prefix: 'pic',
    })
    expect(seq.map((r) => r.renamed)).toEqual(['005_pic.png', '006_pic.png'])
  })

  it('renames a single file on disk', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'old.txt', 'hello')
      const result = asFile(await batchRename([file], { mode: 'prefix', prefix: 'new-' }, h.ctx))
      expect(result.outputPath.endsWith('new-old.txt')).toBe(true)
      expect(await fsp.readFile(result.outputPath, 'utf-8')).toBe('hello')
    } finally {
      await h.cleanup()
    }
  })

  it('zips multiple renamed files', async () => {
    const h = await makeHarness()
    try {
      const a = await writeFixture(h.dir, 'a.txt', 'one')
      const b = await writeFixture(h.dir, 'b.txt', 'two')
      const result = asFile(await batchRename([a, b], { mode: 'sequential', padWidth: 2 }, h.ctx))
      expect(result.outputPath.endsWith('.zip')).toBe(true)
      expect((await fsp.readFile(result.outputPath)).subarray(0, 2).toString()).toBe('PK')
    } finally {
      await h.cleanup()
    }
  })

  it('rejects empty input', async () => {
    const h = await makeHarness()
    try {
      await expect(batchRename([], {}, h.ctx)).rejects.toThrow(/at least one file/)
    } finally {
      await h.cleanup()
    }
  })
})