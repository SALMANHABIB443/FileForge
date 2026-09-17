import fsp from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  entryUncompressedSize,
  hasUnsafePath,
  nestingDepth,
  writeExtractionManifest,
  writeZipArchive,
} from './zip'
import { makeHarness } from '../test-util'

describe('util/zip', () => {
  it('detects unsafe entry paths', () => {
    expect(hasUnsafePath('ok/folder/file.txt')).toBe(false)
    expect(hasUnsafePath('../evil.txt')).toBe(true)
    expect(hasUnsafePath('a\\b')).toBe(true)
    expect(hasUnsafePath('C:\\windows')).toBe(true)
    expect(hasUnsafePath('/etc/passwd')).toBe(true)
    expect(hasUnsafePath('~/.bashrc')).toBe(true)
  })

  it('computes nesting depth', () => {
    expect(nestingDepth('a.txt')).toBe(1)
    expect(nestingDepth('a/b/c.txt')).toBe(3)
  })

  it('writes a ZIP archive into the work dir', async () => {
    const h = await makeHarness()
    try {
      const result = await writeZipArchive(
        h.ctx,
        [
          { name: 'a.txt', data: Buffer.from('alpha') },
          { name: 'b.txt', data: Buffer.from('beta') },
        ],
        'input.txt',
        'files',
      )
      expect(result.kind).toBe('file')
      expect(result.filename).toBe('input_files.zip')
      expect(await fsp.stat(result.outputPath)).toBeDefined()
      const zip = await JSZip.loadAsync(await fsp.readFile(result.outputPath))
      expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['a.txt', 'b.txt']))
    } finally {
      await h.cleanup()
    }
  })

  it('writes an extraction manifest report', async () => {
    const h = await makeHarness()
    try {
      const result = await writeExtractionManifest(
        h.ctx,
        {
          title: 'FileForge extraction report',
          files: [{ name: 'a.txt', size: 5 }],
          skipped: ['bad/../x.txt'],
          destination: path.resolve('out'),
          fallback: true,
        },
        'archive.zip',
      )
      expect(result.outputPath.endsWith('.txt')).toBe(true)
      const text = await fsp.readFile(result.outputPath, 'utf-8')
      expect(text).toContain('Files extracted: 1')
      expect(text).toContain('Skipped (unsafe paths)')
    } finally {
      await h.cleanup()
    }
  })

  it('exposes entry uncompressed size', () => {
    expect(entryUncompressedSize({ _data: { uncompressedSize: 42 } })).toBe(42)
    expect(entryUncompressedSize({})).toBe(0)
  })
})