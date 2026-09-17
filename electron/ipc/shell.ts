import { ipcMain, shell } from 'electron'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { IPC } from '../channels'
import type { OpenPathResult, ShellActionResult } from '../types'
import { assertNoNullByte } from '../security/path-validation'

function requireSafePath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('path must be a non-empty string')
  }
  assertNoNullByte(raw)
  return path.resolve(raw)
}

export function registerShellHandlers(): void {
  ipcMain.handle(IPC.ShellOpenPath, async (_event, raw: unknown): Promise<OpenPathResult> => {
    const resolved = requireSafePath(raw)
    const st = await fsp.stat(resolved).catch(() => null)
    if (!st || !st.isFile()) {
      return { ok: false, error: 'Path does not point to an existing file' }
    }
    const err = await shell.openPath(resolved)
    return err ? { ok: false, error: err } : { ok: true }
  })

  ipcMain.handle(IPC.ShellShowItemInFolder, (_event, raw: unknown): ShellActionResult => {
    const resolved = requireSafePath(raw)
    shell.showItemInFolder(resolved)
    return { ok: true }
  })
}