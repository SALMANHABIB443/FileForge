import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  approveReadPaths,
  isApprovedRead,
  firstApprovedReadDir,
  addWriteRoot,
  isWriteTargetAllowed,
  clearApprovals,
} from './approval'
import { setTempBase } from './temp'

describe('approval registry', () => {
  let temp: string
  let tempBase: string

  beforeEach(async () => {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-approval-'))
    tempBase = path.join(temp, 'tb')
    setTempBase(tempBase)
    clearApprovals()
  })

  afterEach(async () => {
    clearApprovals()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('approves read paths and grants write access beside them', () => {
    const file = path.join(temp, 'input', 'a.txt')
    expect(approveReadPaths([file])).toBe(1)
    expect(isApprovedRead(file)).toBe(true)
    expect(isApprovedRead(path.join(temp, 'input', 'b.txt'))).toBe(false)
    expect(isWriteTargetAllowed(path.join(temp, 'input', 'out.txt'))).toBe(true)
    expect(isWriteTargetAllowed(path.join(temp, 'somewhere-else', 'x.txt'))).toBe(false)
  })

  it('counts only new approvals', () => {
    const file = path.join(temp, 'in', 'a.txt')
    expect(approveReadPaths([file])).toBe(1)
    expect(approveReadPaths([file])).toBe(0)
    expect(approveReadPaths([file, path.join(temp, 'in2', 'b.txt')])).toBe(1)
  })

  it('firstApprovedReadDir returns the first approved parent', () => {
    expect(firstApprovedReadDir()).toBeNull()
    approveReadPaths([path.join(temp, 'b', 'x.txt')])
    expect(firstApprovedReadDir()).toBe(path.dirname(path.resolve(path.join(temp, 'b', 'x.txt'))))
  })

  it('always allows writes under the temp base', () => {
    expect(isWriteTargetAllowed(path.join(tempBase, 'jobs', 'abc', 'out.bin'))).toBe(true)
    expect(isWriteTargetAllowed(path.join(tempBase, '..', 'elsewhere'))).toBe(false)
  })

  it('explicit write roots work and are resolved', () => {
    addWriteRoot(path.join(temp, 'output'))
    expect(isWriteTargetAllowed(path.join(temp, 'output', 'sub', 'f.png'))).toBe(true)
    expect(isWriteTargetAllowed(path.join(temp, 'output2', 'f.png'))).toBe(false)
  })

  it('clearApprovals resets everything', () => {
    approveReadPaths([path.join(temp, 'in', 'a.txt')])
    clearApprovals()
    expect(isApprovedRead(path.join(temp, 'in', 'a.txt'))).toBe(false)
    expect(isWriteTargetAllowed(path.join(temp, 'in', 'out.txt'))).toBe(false)
  })

  it('resolves relative paths consistently', () => {
    vi.spyOn(process, 'cwd').mockReturnValueOnce(temp)
    approveReadPaths(['relative/in/file.txt'])
    expect(isApprovedRead(path.join(temp, 'relative', 'in', 'file.txt'))).toBe(true)
    vi.restoreAllMocks()
  })
})