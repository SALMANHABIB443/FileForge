import { describe, expect, it } from 'vitest'
import { zipBlobs } from '@/utils/zip'

async function entriesLength(blob: Blob): Promise<number> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(blob)
  return Object.keys(zip.files).length
}

describe('zipBlobs', () => {
  it('creates an empty zip for no entries', async () => {
    const blob = await zipBlobs([])
    expect(blob.type).toBe('application/zip')
    expect(await entriesLength(blob)).toBe(0)
  })

  it('zips a single blob entry with its name', async () => {
    const blob = await zipBlobs([{ name: 'a.txt', blob: new Blob(['hello']) }])
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    expect(await zip.file('a.txt')?.async('text')).toBe('hello')
  })

  it('zips multiple entries in order', async () => {
    const blob = await zipBlobs([
      { name: 'one.txt', blob: new Blob(['1']) },
      { name: 'two.txt', blob: new Blob(['2']) },
    ])
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files).length).toBe(2)
    expect(await zip.file('one.txt')?.async('text')).toBe('1')
    expect(await zip.file('two.txt')?.async('text')).toBe('2')
  })

  it('accepts Uint8Array entries', async () => {
    const blob = await zipBlobs([{ name: 'data.bin', blob: new Uint8Array([1, 2, 3]) }])
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    const bytes = await zip.file('data.bin')?.async('uint8array')
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
  })
})