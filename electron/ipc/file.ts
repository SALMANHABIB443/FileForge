import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { IPC } from '../channels'
import type {
  ExtractWriteRequest,
  SaveAsOutputRequest,
  SaveOutputRequest,
  SaveOutputResult,
  SelectedFileInfo,
  SelectFolderResult,
  StatInfo,
  WriteFileRequest,
} from '../types'
import {
  addWriteRoot,
  approveReadPaths,
  clearApprovals,
  firstApprovedReadDir,
  isApprovedRead,
  isWriteTargetAllowed,
} from '../services/approval'
import { tempBaseDir } from '../services/temp'
import { isOverwriteMode, resolveOutputTarget } from '../services/overwrite'
import { assertNoNullByte, assertNoTraversal, assertNotAbsolute, safeJoin, sanitizeSegment } from '../security/path-validation'

function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function toBuffer(data: unknown): Buffer {
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  throw new Error('Invalid binary payload')
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
}

function safeName(filename: string): string {
  const clean = sanitizeSegment(filename)
  return clean === '' ? 'output' : clean
}

async function statPath(raw: unknown): Promise<StatInfo | null> {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  assertNoNullByte(raw)
  const resolved = path.resolve(raw)
  try {
    const st = await fsp.stat(resolved)
    return {
      path: resolved,
      name: path.basename(resolved),
      size: st.size,
      isFile: st.isFile(),
      isDirectory: st.isDirectory(),
      lastModified: st.mtimeMs,
    }
  } catch {
    return null
  }
}

function fileFiltersFromName(filename: string): Electron.FileFilter[] {
  const ext = path.extname(filename).replace(/^\./, '').toLowerCase()
  if (!ext) return [{ name: 'All Files', extensions: ['*'] }]
  return [
    { name: `${ext.toUpperCase()} files`, extensions: [ext] },
    { name: 'All Files', extensions: ['*'] },
  ]
}

export function registerFileHandlers(): void {
  addWriteRoot(tempBaseDir())
  ipcMain.handle(IPC.FileSelectFiles, async (event): Promise<SelectedFileInfo[]> => {
    const win = windowFromEvent(event)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (result.canceled) return []

    const infos: SelectedFileInfo[] = []
    const approved: string[] = []
    for (const raw of result.filePaths) {
      const st = await statPath(raw)
      if (st && st.isFile) {
        infos.push({ path: st.path, name: st.name, size: st.size, lastModified: st.lastModified })
        approved.push(st.path)
      }
    }
    approveReadPaths(approved)
    return infos
  })

  ipcMain.handle(IPC.FileSelectFolder, async (event): Promise<SelectFolderResult | null> => {
    const win = windowFromEvent(event)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    const selected = result.filePaths[0]!
    addWriteRoot(selected)
    return { path: selected, name: path.basename(selected) }
  })

  ipcMain.handle(IPC.FileStat, (_event, raw) => statPath(raw))

  ipcMain.handle(IPC.FileRead, async (_event, raw) => {
    assertString(raw, 'path')
    assertNoNullByte(raw)
    const resolved = path.resolve(raw)
    if (!isApprovedRead(resolved)) {
      throw new Error('Path is not approved for reading — select it through the file dialog first')
    }
    const st = await fsp.stat(resolved)
    if (!st.isFile()) throw new Error('Path is not a file')
    const data = await fsp.readFile(resolved)
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  })

  ipcMain.handle(IPC.FileWrite, async (_event, request: WriteFileRequest) => {
    if (!request || typeof request.path !== 'string') throw new Error('Invalid write request')
    const resolved = path.resolve(request.path)
    if (!isWriteTargetAllowed(resolved)) {
      throw new Error('Path is not within an allowed output directory')
    }
    await fsp.mkdir(path.dirname(resolved), { recursive: true })
    await fsp.writeFile(resolved, toBuffer(request.data))
    return resolved
  })

  ipcMain.handle(IPC.FileExtractWrite, async (_event, request: ExtractWriteRequest) => {
    if (!request || typeof request.root !== 'string' || typeof request.entryPath !== 'string') {
      throw new Error('Invalid extraction request')
    }
    const root = path.resolve(request.root)
    if (!isWriteTargetAllowed(root)) {
      throw new Error('Extraction target is not within an allowed directory')
    }
    assertNotAbsolute(request.entryPath)
    assertNoTraversal(request.entryPath)
    const target = safeJoin(root, request.entryPath)
    await fsp.mkdir(path.dirname(target), { recursive: true })
    await fsp.writeFile(target, toBuffer(request.data))
    return target
  })

  ipcMain.handle(IPC.FileApprovePaths, (_event, paths: string[]) => {
    if (!Array.isArray(paths)) return 0
    const valid = paths.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    return approveReadPaths(valid)
  })

  ipcMain.handle(IPC.FileClearApprovals, () => {
    clearApprovals()
  })

  ipcMain.handle(IPC.FileGetTempDir, () => tempBaseDir())

  ipcMain.handle(IPC.FileSaveOutput, async (_event, request: SaveOutputRequest): Promise<SaveOutputResult | null> => {
    if (!request) throw new Error('Invalid save request')
    const data = toBuffer(request.data)
    const suggestedName = safeName(request.suggestedName ?? 'output')

    let targetDir: string
    let location: SaveOutputResult['location']

    if (typeof request.outputDir === 'string' && request.outputDir.trim() !== '') {
      const candidate = path.resolve(request.outputDir)
      if (!isWriteTargetAllowed(candidate)) {
        throw new Error('Configured output directory is no longer approved — reopen it from Settings')
      }
      targetDir = candidate
      location = 'outputDir'
    } else {
      const inputDir = firstApprovedReadDir()
      if (inputDir) {
        targetDir = inputDir
        location = 'inputFolder'
      } else {
        targetDir = tempBaseDir()
        location = 'temp'
      }
    }

    await fsp.mkdir(targetDir, { recursive: true })
    const mode = isOverwriteMode(request.overwriteMode) ? request.overwriteMode : 'autorename'
    const outPath = await resolveOutputTarget(windowFromEvent(_event), targetDir, suggestedName, mode)
    await fsp.writeFile(outPath, data)
    return { path: outPath, location }
  })

  ipcMain.handle(IPC.FileSaveAs, async (event, request: SaveAsOutputRequest): Promise<string | null> => {
    if (!request) throw new Error('Invalid save-as request')
    const data = toBuffer(request.data)
    const suggestedName = safeName(request.suggestedName ?? 'output')

    let defaultPath = path.join(tempBaseDir(), suggestedName)
    if (typeof request.defaultDir === 'string' && request.defaultDir.trim() !== '') {
      defaultPath = path.join(path.resolve(request.defaultDir), suggestedName)
    }

    const win = windowFromEvent(event)
    const options: Electron.SaveDialogOptions = {
      title: 'Save output',
      defaultPath,
      filters: fileFiltersFromName(suggestedName),
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null

    const target = result.filePath
    await fsp.mkdir(path.dirname(target), { recursive: true })
    await fsp.writeFile(target, data)
    return target
  })
}