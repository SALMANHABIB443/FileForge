import { describe, it, expect } from 'vitest'
import { computeRenames } from './rename-engine'
import type { FileMeta } from '@/types/job'

function makeFile(name: string, size = 100): FileMeta {
  return { id: crypto.randomUUID(), name, size, type: 'application/octet-stream', lastModified: Date.now() }
}

describe('computeRenames', () => {
  const files = [makeFile('photo.jpg'), makeFile('document.pdf'), makeFile('notes.txt')]

  it('adds prefix', () => {
    const result = computeRenames(files, { mode: 'prefix', prefix: 'trip_' })
    expect(result[0]!.renamed).toBe('trip_photo.jpg')
    expect(result[1]!.renamed).toBe('trip_document.pdf')
    expect(result[2]!.renamed).toBe('trip_notes.txt')
  })

  it('adds suffix', () => {
    const result = computeRenames(files, { mode: 'suffix', suffix: '_final' })
    expect(result[0]!.renamed).toBe('photo_final.jpg')
    expect(result[1]!.renamed).toBe('document_final.pdf')
  })

  it('find and replace', () => {
    const result = computeRenames(files, { mode: 'find-replace', findText: 'photo', replaceText: 'image' })
    expect(result[0]!.renamed).toBe('image.jpg')
    expect(result[1]!.renamed).toBe('document.pdf')
  })

  it('sequential numbering', () => {
    const result = computeRenames(files, { mode: 'sequential', startNumber: 1, padWidth: 3 })
    expect(result[0]!.renamed).toBe('001.jpg')
    expect(result[1]!.renamed).toBe('002.pdf')
    expect(result[2]!.renamed).toBe('003.txt')
  })

  it('sequential with prefix', () => {
    const result = computeRenames(files, { mode: 'sequential', startNumber: 5, padWidth: 2, prefix: 'img' })
    expect(result[0]!.renamed).toBe('05_img.jpg')
    expect(result[1]!.renamed).toBe('06_img.pdf')
  })

  it('handles files without extension', () => {
    const noExt = [makeFile('README')]
    const result = computeRenames(noExt, { mode: 'prefix', prefix: 'v2_' })
    expect(result[0]!.renamed).toBe('v2_README')
  })

  it('preserves original names when no change needed', () => {
    const result = computeRenames(files, { mode: 'prefix', prefix: '' })
    expect(result[0]!.renamed).toBe('photo.jpg')
    expect(result[1]!.renamed).toBe('document.pdf')
  })

  it('find-replace with no match returns original', () => {
    const result = computeRenames(files, { mode: 'find-replace', findText: 'xyz', replaceText: 'abc' })
    expect(result[0]!.renamed).toBe('photo.jpg')
    expect(result[1]!.renamed).toBe('document.pdf')
  })
})
