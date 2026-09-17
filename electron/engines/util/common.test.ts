import { describe, expect, it } from 'vitest'
import {
  assertMediaSizeAllowed,
  formatFileSize,
  getFileExtension,
  getMediaFileWarnings,
  resolveCollision,
  sanitizeFilename,
} from './common'

describe('util/common', () => {
  it('generates filenames', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg')
    expect(getFileExtension('no-ext')).toBe('')
    expect(sanitizeFilename('a/b\\c:d*e"f<g>h|i?j')).not.toMatch(/[<>:"/\\|?*]/)
    expect(sanitizeFilename('  spaced  name  ')).toBe('spaced_name')
  })

  it('resolves filename collisions', () => {
    const taken = new Set(['a.txt', 'a (1).txt'])
    expect(resolveCollision('a.txt', taken)).toBe('a (2).txt')
    expect(resolveCollision('fresh.txt', taken)).toBe('fresh.txt')
  })

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('enforces media size limits', () => {
    expect(() => assertMediaSizeAllowed(0)).toThrow()
    expect(() => assertMediaSizeAllowed(1024 * 1024 * 1024 + 1)).toThrow(/supported limit/)
    expect(assertMediaSizeAllowed(1024)).toBeUndefined()
    expect(getMediaFileWarnings(1024)).toBeNull()
    expect(getMediaFileWarnings(250 * 1024 * 1024)).toMatch(/large file/)
    expect(getMediaFileWarnings(2 * 1024 * 1024 * 1024)).toMatch(/supported limit/)
  })
})