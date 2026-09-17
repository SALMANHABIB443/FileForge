import fs from 'node:fs'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { uniquePath } from '../security/path-validation'

/**
 * Overwrite protection policy for auto-saved outputs.
 * - `autorename` (default): never overwrite — save with a ` (1)`, ` (2)` … suffix.
 * - `confirm`: ask the user once before replacing an existing file.
 */
export type OverwriteMode = 'autorename' | 'confirm'

export function isOverwriteMode(value: unknown): value is OverwriteMode {
  return value === 'autorename' || value === 'confirm'
}

/**
 * Pure decision helper: returns the exact target path for a save.
 * When `overwrite` is true the requested name is used as-is (replacing any
 * existing file); otherwise `uniquePath` yields a collision-free name.
 */
export function resolveSaveTarget(
  dir: string,
  filename: string,
  exists: (p: string) => boolean,
  overwrite: boolean,
): string {
  const target = path.join(dir, filename)
  if (overwrite) return target
  return uniquePath(dir, exists, filename)
}

/**
 * Shows the overwrite confirmation dialog and resolves a target path.
 * "Overwrite" keeps the requested name; anything else (Keep both / cancel)
 * falls back to auto-renaming so a file is never silently replaced.
 */
export async function pickOverwriteTarget(
  win: BrowserWindow | null,
  dir: string,
  filename: string,
  exists: (p: string) => boolean,
): Promise<string> {
  const { dialog } = await import('electron')
  const options: Electron.MessageBoxOptions = {
    type: 'question',
    buttons: ['Overwrite', 'Keep both'],
    defaultId: 1,
    cancelId: 1,
    title: 'File already exists',
    message: 'A file with this name already exists in the destination.',
    detail: `"${filename}" — overwrite the existing file, or keep both by saving it with a new name?`,
    noLink: true,
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)
  return resolveSaveTarget(dir, filename, exists, response === 0)
}

/**
 * Applies the configured overwrite policy to a single-file save.
 */
export async function resolveOutputTarget(
  win: BrowserWindow | null,
  dir: string,
  filename: string,
  mode: OverwriteMode,
): Promise<string> {
  const exists = (p: string): boolean => fs.existsSync(p)
  if (mode === 'confirm') {
    const target = path.join(dir, filename)
    if (exists(target)) {
      return pickOverwriteTarget(win, dir, filename, exists)
    }
  }
  return resolveSaveTarget(dir, filename, exists, false)
}