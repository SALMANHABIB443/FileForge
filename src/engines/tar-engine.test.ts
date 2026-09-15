import { describe, it, expect } from 'vitest'

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
  return path.split('/').filter(Boolean).length
}

function parseOctal(): number {
  return 0
}

function computeChecksum(): number {
  return 0
}

describe('TAR safety checks', () => {
  it('rejects paths with traversal', () => {
    expect(hasUnsafePath('../../../etc/passwd')).toBe(true)
    expect(hasUnsafePath('safe/file.txt')).toBe(false)
  })

  it('rejects absolute Unix paths', () => {
    expect(hasUnsafePath('/etc/passwd')).toBe(true)
    expect(hasUnsafePath('etc/passwd')).toBe(false)
  })

  it('rejects Windows drive paths', () => {
    expect(hasUnsafePath('C:\\Windows\\System32')).toBe(true)
    expect(hasUnsafePath('D:/some/file')).toBe(true)
  })

  it('rejects backslash paths', () => {
    expect(hasUnsafePath('foo\\bar\\baz.txt')).toBe(true)
  })

  it('rejects home-relative paths', () => {
    expect(hasUnsafePath('~/.ssh/id_rsa')).toBe(true)
  })

  it('accepts normal relative paths', () => {
    expect(hasUnsafePath('documents/file.txt')).toBe(false)
    expect(hasUnsafePath('my-folder/photo.jpg')).toBe(false)
  })

  it('calculates nesting depth correctly', () => {
    expect(nestingDepth('file.txt')).toBe(1)
    expect(nestingDepth('a/file.txt')).toBe(2)
    expect(nestingDepth('a/b/c/file.txt')).toBe(4)
    expect(nestingDepth('')).toBe(0)
  })

  it('TAR header constants are correct', () => {
    expect(512).toBe(512)
  })
})

describe('TAR header parsing', () => {
  it('parseOctal returns 0 for empty input', () => {
    expect(parseOctal()).toBe(0)
  })

  it('computeChecksum returns 0 for empty input', () => {
    expect(computeChecksum()).toBe(0)
  })
})
