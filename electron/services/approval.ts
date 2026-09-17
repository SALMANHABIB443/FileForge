import path from 'node:path'
import { isWithinOrEqual } from '../security/path-validation'
import { tempBaseDir } from './temp'

/**
 * Session-scoped approval registry.
 *
 * Reads are only allowed for paths the user explicitly picked through a native
 * dialog or dropped onto the window this session (see `approvePaths`).
 *
 * Writes are allowed beneath:
 *  - the temp base dir,
 *  - any directory root explicitly chosen this session (output dir, extraction target),
 *  - the parent directory of any approved input file ("save beside input" fallback).
 */
const approvedReadPaths = new Set<string>()
const writeRoots = new Set<string>()

export function approveReadPaths(paths: string[]): number {
  let count = 0
  for (const p of paths) {
    const resolved = path.resolve(p)
    if (approvedReadPaths.has(resolved)) continue
    approvedReadPaths.add(resolved)
    writeRoots.add(path.dirname(resolved))
    count++
  }
  return count
}

export function isApprovedRead(candidate: string): boolean {
  return approvedReadPaths.has(path.resolve(candidate))
}

export function firstApprovedReadDir(): string | null {
  for (const p of approvedReadPaths) {
    return path.dirname(p)
  }
  return null
}

export function addWriteRoot(root: string): void {
  writeRoots.add(path.resolve(root))
}

export function isWriteTargetAllowed(candidate: string): boolean {
  const resolved = path.resolve(candidate)
  if (isWithinOrEqual(tempBaseDir(), resolved)) return true
  for (const root of writeRoots) {
    if (isWithinOrEqual(root, resolved)) return true
  }
  return false
}

export function clearApprovals(): void {
  approvedReadPaths.clear()
  writeRoots.clear()
}