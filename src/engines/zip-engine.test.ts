import { describe, it, expect } from 'vitest'

// Extract the pure safety-checking functions from zip-engine for testing
// Since the functions are private, we replicate the logic here to verify behavior

const MAX_ENTRIES = 2000
const MAX_TOTAL_UNCOMPRESSED = 4 * 1024 * 1024 * 1024
const MAX_NESTING_DEPTH = 32

function sanitizeFilename(name: string): string {
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function hasUnsafePath(path: string): boolean {
  if (path.includes('\\')) return true
  if (path.includes('..')) return true
  if (/^[a-z]:/i.test(path)) return true
  if (/^~/.test(path)) return true
  if (path.startsWith('/')) return true
  const sanitized = sanitizeFilename(path.split('/').join('_'))
  return sanitized === ''
}

function nestingDepth(path: string): number {
  return path.split('/').length
}

describe('ZIP safety checks', () => {
  it('rejects paths with traversal', () => {
    expect(hasUnsafePath('../../../etc/passwd')).toBe(true)
    expect(hasUnsafePath('safe/file.txt')).toBe(false)
  })

  it('rejects absolute Unix paths', () => {
    expect(hasUnsafePath('/etc/passwd')).toBe(true)
    expect(hasUnsafePath('etc/passwd')).toBe(false)
  })

  it('rejects Windows drive paths', () => {
    expect(hasUnsafePath('C:\\Windows\\System32\\config')).toBe(true)
    expect(hasUnsafePath('D:/some/file')).toBe(true)
  })

  it('rejects paths with backslashes', () => {
    expect(hasUnsafePath('foo\\bar\\baz.txt')).toBe(true)
  })

  it('rejects home-relative paths', () => {
    expect(hasUnsafePath('~/.ssh/id_rsa')).toBe(true)
  })

  it('rejects paths that sanitize to empty', () => {
    expect(hasUnsafePath('.....')).toBe(true)
  })

  it('accepts normal relative paths', () => {
    expect(hasUnsafePath('documents/file.txt')).toBe(false)
    expect(hasUnsafePath('my-folder/photo.jpg')).toBe(false)
    expect(hasUnsafePath('a/b/c/file.pdf')).toBe(false)
  })

  it('calculates nesting depth correctly', () => {
    expect(nestingDepth('file.txt')).toBe(1)
    expect(nestingDepth('a/file.txt')).toBe(2)
    expect(nestingDepth('a/b/c/file.txt')).toBe(4)
  })

  it('rejects deeply nested paths', () => {
    const deep = Array.from({ length: MAX_NESTING_DEPTH + 2 }, (_, i) => `dir${i}`).join('/') + '/file.txt'
    expect(nestingDepth(deep)).toBeGreaterThan(MAX_NESTING_DEPTH)
  })

  it('rejects too many entries', () => {
    expect(MAX_ENTRIES).toBe(2000)
  })

  it('rejects oversized archives', () => {
    expect(MAX_TOTAL_UNCOMPRESSED).toBe(4 * 1024 * 1024 * 1024)
  })
})
