import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  assertNoNullByte,
  assertNoTraversal,
  assertNotAbsolute,
  isWindowsReservedName,
  sanitizeSegment,
  safeJoin,
  isWithinOrEqual,
  uniquePath,
} from './path-validation'
import type { PathValidationError } from './path-validation'

function errCode(fn: () => unknown): PathValidationError['code'] | null {
  try {
    fn()
    return null
  } catch (e) {
    return (e as PathValidationError).code ?? null
  }
}

describe('path-validation', () => {
  it('rejects null bytes', () => {
    expect(() => assertNoNullByte('a\0b')).toThrow('null byte')
    expect(errCode(() => assertNoNullByte('a\0b'))).toBe('E_NULLBYTE')
  })

  it('rejects .. traversal in any separator style', () => {
    expect(errCode(() => assertNoTraversal('a/../b'))).toBe('E_PATHTRAVERSAL')
    expect(errCode(() => assertNoTraversal('a\\..\\b'))).toBe('E_PATHTRAVERSAL')
    expect(errCode(() => assertNoTraversal('..'))).toBe('E_PATHTRAVERSAL')
    expect(() => assertNoTraversal('a/b')).not.toThrow()
  })

  it('rejects absolute paths when a relative one is required', () => {
    expect(errCode(() => assertNotAbsolute('/etc/passwd'))).toBe('E_ABSOLUTE')
    expect(errCode(() => assertNotAbsolute('C:\\Windows'))).toBe('E_ABSOLUTE')
    expect(errCode(() => assertNotAbsolute('\\\\server\\share'))).toBe('E_ABSOLUTE')
    expect(() => assertNotAbsolute('folder/file.txt')).not.toThrow()
  })

  it('detects Windows reserved device names', () => {
    expect(isWindowsReservedName('CON')).toBe(true)
    expect(isWindowsReservedName('con.txt')).toBe(true)
    expect(isWindowsReservedName('LPT9')).toBe(true)
    expect(isWindowsReservedName('report')).toBe(false)
  })

  it('sanitizes invalid segments without escaping the root', () => {
    expect(sanitizeSegment('a:b')).toBe('a_b')
    expect(sanitizeSegment('CON')).toBe('_CON')
    expect(sanitizeSegment('name ')).toBe('name')
    expect(sanitizeSegment('..')).toBe('_')
    expect(sanitizeSegment('x>y')).toBe('x_y')
  })

  it('safeJoin keeps targets inside the root', () => {
    const root = 'C:\\work\\out'
    expect(safeJoin(root, 'sub/file.txt')).toBe('C:\\work\\out\\sub\\file.txt')
  })

  it('safeJoin blocks traversal and absolute entries', () => {
    const root = 'C:\\work\\out'
    expect(() => safeJoin(root, 'sub/../../evil.txt')).toThrow('traversal')
    expect(() => safeJoin(root, 'C:\\Windows\\evil.txt')).toThrow('relative path')
    expect(() => safeJoin(root, 'a/..\\..\\b')).toThrow('traversal')
  })

  it('isWithinOrEqual compares resolved paths', () => {
    const root = path.resolve('C:/work/out')
    expect(isWithinOrEqual(root, path.join(root, 'a/b.txt'))).toBe(true)
    expect(isWithinOrEqual(root, root)).toBe(true)
    expect(isWithinOrEqual(root, path.resolve('C:/work/elsewhere'))).toBe(false)
  })

  it('uniquePath appends an ascending suffix on conflicts', () => {
    const existing = ['file.txt', 'file (1).txt']
    const exists = (p: string) => existing.includes(path.basename(p))
    expect(path.basename(uniquePath('C:/out', exists, 'file.txt'))).toBe('file (2).txt')
    expect(path.basename(uniquePath('C:/out', () => false, 'file.txt'))).toBe('file.txt')
  })
})