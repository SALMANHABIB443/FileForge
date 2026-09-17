import { describe, expect, it } from 'vitest'
import { findDuplicates } from './duplicate'
import { makeHarness, writeFixture } from '../test-util'

describe('modules/duplicate', () => {
  it('groups identical files and ignores unique ones', async () => {
    const h = await makeHarness()
    try {
      const dupA = await writeFixture(h.dir, 'a.txt', 'same content here')
      const dupB = await writeFixture(h.dir, 'b.txt', 'same content here')
      const unique = await writeFixture(h.dir, 'c.txt', 'totally different')

      const groups = await findDuplicates([unique, dupA, dupB], h.ctx)
      expect(groups).toHaveLength(1)
      expect(groups[0]!.size).toBe(dupA.size)
      expect(groups[0]!.files.map((f) => f.name).sort()).toEqual(['a.txt', 'b.txt'])
    } finally {
      await h.cleanup()
    }
  })

  it('returns no groups when all files differ', async () => {
    const h = await makeHarness()
    try {
      const files = [
        await writeFixture(h.dir, 'a.txt', 'content-a'),
        await writeFixture(h.dir, 'b.txt', 'content-b'),
      ]
      expect(await findDuplicates(files, h.ctx)).toHaveLength(0)
    } finally {
      await h.cleanup()
    }
  })

  it('respects abort signals', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'a.txt', 'content')
      const controller = new AbortController()
      controller.abort()
      const ctx = { ...h.ctx, signal: controller.signal }
      await expect(findDuplicates([file], ctx)).rejects.toThrow(/cancelled|abort/i)
    } finally {
      await h.cleanup()
    }
  })
})