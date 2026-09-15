import { describe, it, expect } from 'vitest'
import {
  generateOutputName,
  resolveCollision,
  sanitizeFilename,
  formatFileSize,
  formatSizeComparison,
  getFileExtension,
} from '@/utils/filename'

describe('generateOutputName', () => {
  it('generates output name with suffix and extension', () => {
    const result = generateOutputName('photo.jpg', 'compressed', 'jpg')
    expect(result).toBe('photo_compressed.jpg')
  })

  it('handles names with multiple dots', () => {
    const result = generateOutputName('my.photo.v2.png', 'resized', 'webp')
    expect(result).toBe('my.photo.v2_resized.webp')
  })

  it('handles names without extension', () => {
    const result = generateOutputName('document', 'converted', 'pdf')
    expect(result).toBe('document_converted.pdf')
  })
})

describe('resolveCollision', () => {
  it('returns name unchanged if no collision', () => {
    const result = resolveCollision('file.txt', new Set(['other.txt']))
    expect(result).toBe('file.txt')
  })

  it('appends (1) on first collision', () => {
    const result = resolveCollision('file.txt', new Set(['file.txt']))
    expect(result).toBe('file (1).txt')
  })

  it('appends (2) on second collision', () => {
    const existing = new Set(['file.txt', 'file (1).txt'])
    const result = resolveCollision('file.txt', existing)
    expect(result).toBe('file (2).txt')
  })

  it('handles names without extension', () => {
    const result = resolveCollision('readme', new Set(['readme']))
    expect(result).toBe('readme (1)')
  })
})

describe('sanitizeFilename', () => {
  it('replaces invalid characters', () => {
    const result = sanitizeFilename('my<file>:name.jpg')
    expect(result).toBe('my_file_name.jpg')
  })

  it('replaces spaces with underscores', () => {
    const result = sanitizeFilename('my file name.jpg')
    expect(result).toBe('my_file_name.jpg')
  })

  it('collapses multiple underscores', () => {
    const result = sanitizeFilename('a___b.jpg')
    expect(result).toBe('a_b.jpg')
  })

  it('trims leading and trailing underscores', () => {
    const result = sanitizeFilename('_file_.jpg')
    expect(result).toBe('file_.jpg')
  })
})

describe('formatFileSize', () => {
  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB')
  })
})

describe('getFileExtension', () => {
  it('extracts extension', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg')
  })

  it('handles multiple dots', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('returns empty for no extension', () => {
    expect(getFileExtension('Makefile')).toBe('')
  })
})

describe('formatSizeComparison', () => {
  it('reports smaller with percent', () => {
    expect(formatSizeComparison(1048576, 734003)).toBe('1.0 MB → 716.8 KB · 30% smaller')
  })

  it('reports larger with percent', () => {
    expect(formatSizeComparison(1048576, 1572864)).toBe('1.0 MB → 1.5 MB · 50% larger')
  })

  it('reports about the same within 1 percent', () => {
    expect(formatSizeComparison(1048576, 1050000)).toBe(
      '1.0 MB → 1.0 MB · about the same size',
    )
  })

  it('handles zero input bytes', () => {
    expect(formatSizeComparison(0, 1024)).toBe('0 B → 1.0 KB')
  })
})
