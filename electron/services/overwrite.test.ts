import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isOverwriteMode, resolveSaveTarget } from './overwrite'

describe('overwrite protection', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'ff-overwrite-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const exists = (p: string): boolean => existsSync(p)

  it('recognizes only the supported modes', () => {
    expect(isOverwriteMode('autorename')).toBe(true)
    expect(isOverwriteMode('confirm')).toBe(true)
    expect(isOverwriteMode('overwrite')).toBe(false)
    expect(isOverwriteMode(undefined)).toBe(false)
    expect(isOverwriteMode(null)).toBe(false)
    expect(isOverwriteMode(42)).toBe(false)
  })

  it('uses the requested name when the file does not exist', () => {
    const target = resolveSaveTarget(dir, 'out.txt', exists, false)
    expect(target).toBe(path.join(dir, 'out.txt'))
  })

  it('renames with a (1) suffix on collision when not overwriting', () => {
    writeFileSync(path.join(dir, 'out.txt'), 'a')
    const target = resolveSaveTarget(dir, 'out.txt', exists, false)
    expect(path.basename(target)).toBe('out (1).txt')
  })

  it('increments the suffix until the name is free', () => {
    writeFileSync(path.join(dir, 'out.txt'), 'a')
    writeFileSync(path.join(dir, 'out (1).txt'), 'b')
    const target = resolveSaveTarget(dir, 'out.txt', exists, false)
    expect(path.basename(target)).toBe('out (2).txt')
  })

  it('keeps the requested name when overwriting is chosen', () => {
    writeFileSync(path.join(dir, 'out.txt'), 'a')
    const target = resolveSaveTarget(dir, 'out.txt', exists, true)
    expect(target).toBe(path.join(dir, 'out.txt'))
  })

  it('never produces a path that collides with an existing file', () => {
    writeFileSync(path.join(dir, 'out.txt'), 'a')
    writeFileSync(path.join(dir, 'out (1).txt'), 'b')
    writeFileSync(path.join(dir, 'out (2).txt'), 'c')
    const target = resolveSaveTarget(dir, 'out.txt', exists, false)
    expect(target).toBe(path.join(dir, 'out (3).txt'))
  })
})