import path from 'node:path'

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g

export interface PathValidationError extends Error {
  code: 'E_PATHTRAVERSAL' | 'E_NULLBYTE' | 'E_ABSOLUTE' | 'E_RESERVED' | 'E_INSANEPATH' | 'E_OUTSIDEROOT'
}

function fail(code: PathValidationError['code'], message: string): never {
  const err = new Error(message) as PathValidationError
  err.code = code
  throw err
}

export function assertNoNullByte(value: string): void {
  if (value.includes('\0')) {
    fail('E_NULLBYTE', 'Path contains a null byte — rejected')
  }
}

/**
 * Rejects any path containing a `..` segment used for traversal. Because the
 * check runs on the raw string (`[\\/]` split, not just OS separators), it is
 * robust regardless of the platform running the main process.
 */
export function assertNoTraversal(value: string): void {
  assertNoNullByte(value)
  const parts = value.split(/[\\/]+/)
  if (parts.some((part) => part === '..')) {
    fail('E_PATHTRAVERSAL', 'Path contains a traversal segment ("..") — rejected')
  }
}

export function assertNotAbsolute(value: string): void {
  if (
    path.isAbsolute(value) ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    value.startsWith('\\\\') ||
    value.startsWith('/') ||
    value.startsWith('\\')
  ) {
    fail('E_ABSOLUTE', 'A relative path was expected — rejected')
  }
}

export function isWindowsReservedName(name: string): boolean {
  const stem = name.split('.')[0]!.toUpperCase()
  return WINDOWS_RESERVED_NAMES.has(stem)
}

export function sanitizeSegment(segment: string): string {
  let clean = segment.replace(INVALID_FILENAME_CHARS, '_').replace(/[.\s]+$/g, '').replace(/\0/g, '')
  if (clean === '') clean = '_'
  if (isWindowsReservedName(clean)) clean = `_${clean}`
  return clean
}

/**
 * Joins a validated root with a user/library-supplied relative entry path.
 * The relative path is sanitized segment-by-segment, and the final resolved
 * path is asserted to stay inside the root.
 */
export function safeJoin(root: string, relative: string): string {
  assertNotAbsolute(relative)
  assertNoTraversal(relative)
  if (relative === '') {
    fail('E_INSANEPATH', 'Empty relative path — rejected')
  }
  const parts = relative.split('/').filter((p) => p !== '')
  if (parts.length === 0) {
    fail('E_INSANEPATH', 'Empty relative path — rejected')
  }
  const sanitized = parts.map(sanitizeSegment)
  const target = path.resolve(root, ...sanitized)
  assertWithin(root, target)
  return target
}

/**
 * Whether `target` resolves to `root` itself or a descendant of `root`.
 */
export function isWithinOrEqual(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function assertWithin(root: string, target: string): void {
  if (!isWithinOrEqual(root, target)) {
    fail('E_OUTSIDEROOT', 'Path resolves outside the allowed directory — rejected')
  }
}

/**
 * Returns a path in `dir` with a unique filename. Appends ` (1)`, ` (2)`, …
 * before the extension when the base name already exists (overwrite protection).
 */
export function uniquePath(dir: string, failIfExists: (p: string) => boolean, filename: string): string {
  const ext = path.extname(filename)
  const stem = path.basename(filename, ext)
  let candidate = path.join(dir, filename)
  let index = 0
  while (failIfExists(candidate)) {
    index++
    candidate = path.join(dir, `${stem} (${index})${ext}`)
  }
  return candidate
}