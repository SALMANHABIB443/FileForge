import { BrowserWindow, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { IPC } from '../channels'
import { isApprovedRead, firstApprovedReadDir, isWriteTargetAllowed } from '../services/approval'
import { cleanupJobTemp, tempBaseDir } from '../services/temp'
import { isOverwriteMode, resolveOutputTarget } from '../services/overwrite'
import { assertNoNullByte, isWithinOrEqual } from '../security/path-validation'
import { runEngine } from '../engines/runner'
import type {
  EngineInputFile,
  EngineProgressEvent,
  EngineRunRequest,
  OverwriteMode,
  SaveAsFileRequest,
  SaveOutputFileRequest,
  SaveOutputResult,
} from '../types'

const running = new Map<string, AbortController>()

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
}

function validateInputFiles(files: unknown): EngineInputFile[] {
  if (!Array.isArray(files)) throw new Error('files must be an array')
  const seen = new Set<string>()
  return files.map((file, index): EngineInputFile => {
    assertObject(file, `files[${index}]`)
    const rawPath = file.path
    assertString(rawPath, `files[${index}].path`)
    assertNoNullByte(rawPath)
    const resolved = path.resolve(rawPath)
    if (seen.has(resolved)) {
      throw new Error(`Duplicate file in request: ${rawPath}`)
    }
    seen.add(resolved)
    if (!isApprovedRead(resolved)) {
      throw new Error(`Path is not approved for reading — select it through the file dialog first: ${rawPath}`)
    }
    return {
      path: resolved,
      name: typeof file.name === 'string' ? file.name : path.basename(resolved),
      size: Number(file.size) || 0,
      lastModified: typeof file.lastModified === 'number' ? file.lastModified : undefined,
    }
  })
}

async function copyFromSource(
  event: IpcMainInvokeEvent,
  sourcePath: string,
  targetDir: string,
  suggestedName: string,
  location: SaveOutputResult['location'],
  mode: OverwriteMode,
): Promise<SaveOutputResult> {
  assertNoNullByte(sourcePath)
  const source = path.resolve(sourcePath)
  if (!isWithinOrEqual(tempBaseDir(), source)) {
    throw new Error('Source file is not inside the job temp directory')
  }
  const st = await fsp.stat(source)
  if (!st.isFile()) throw new Error('Source is not a file')

  await fsp.mkdir(targetDir, { recursive: true })
  const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null
  const outPath = await resolveOutputTarget(win, targetDir, suggestedName, mode)
  await fsp.copyFile(source, outPath)
  return { path: outPath, location }
}

function fileFiltersFromName(filename: string): Electron.FileFilter[] {
  const ext = path.extname(filename).replace(/^\./, '').toLowerCase()
  if (!ext) return [{ name: 'All Files', extensions: ['*'] }]
  return [
    { name: `${ext.toUpperCase()} files`, extensions: [ext] },
    { name: 'All Files', extensions: ['*'] },
  ]
}

export function registerEngineHandlers(): void {
  ipcMain.handle(IPC.EngineRun, async (event: IpcMainInvokeEvent, raw: unknown) => {
    assertObject(raw, 'request')
    const request = raw as unknown as EngineRunRequest
    assertString(request.requestId, 'requestId')
    assertString(request.kind, 'kind')
    if (running.has(request.requestId)) {
      throw new Error('A request with this id is already running')
    }

    const files = validateInputFiles(request.files)
    const controller = new AbortController()
    running.set(request.requestId, controller)

    const emit = (
      percent: number,
      message?: string,
      detail?: { index?: number; total?: number },
    ): void => {
      const payload: EngineProgressEvent = { requestId: request.requestId, percent, message, detail }
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.EngineProgress, payload)
      }
    }

    try {
      const options = request.options && typeof request.options === 'object' ? request.options : {}
      const result = await runEngine(
        request.requestId,
        request.kind as never,
        files,
        options,
        controller.signal,
        emit,
      )
      return result
    } finally {
      running.delete(request.requestId)
    }
  })

  ipcMain.handle(IPC.EngineCancel, (_event, requestId: string) => {
    assertString(requestId, 'requestId')
    const controller = running.get(requestId)
    if (controller) {
      controller.abort()
    }
  })

  ipcMain.handle(IPC.FileSaveOutputFile, async (_event, request: SaveOutputFileRequest) => {
    if (!request) throw new Error('Invalid save request')
    assertString(request.sourcePath, 'sourcePath')

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

    const suggestedName = request.suggestedName?.trim() ? request.suggestedName : 'output'
    const mode = isOverwriteMode(request.overwriteMode) ? request.overwriteMode : 'autorename'
    return copyFromSource(_event, request.sourcePath, targetDir, suggestedName, location, mode)
  })

  ipcMain.handle(IPC.FileSaveAsFile, async (event: IpcMainInvokeEvent, request: SaveAsFileRequest) => {
    if (!request) throw new Error('Invalid save-as request')
    assertString(request.sourcePath, 'sourcePath')
    assertNoNullByte(request.sourcePath)
    const source = path.resolve(request.sourcePath)
    if (!isWithinOrEqual(tempBaseDir(), source)) {
      throw new Error('Source file is not inside the job temp directory')
    }
    const st = await fsp.stat(source)
    if (!st.isFile()) throw new Error('Source is not a file')

    const suggestedName = request.suggestedName?.trim() ? request.suggestedName : 'output'
    let defaultPath = path.join(tempBaseDir(), suggestedName)
    if (typeof request.defaultDir === 'string' && request.defaultDir.trim() !== '') {
      defaultPath = path.join(path.resolve(request.defaultDir), suggestedName)
    }

    const { BrowserWindow, dialog } = await import('electron')
    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const filters = fileFiltersFromName(suggestedName)

    const options: Electron.SaveDialogOptions = { title: 'Save output', defaultPath, filters }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null

    const target = result.filePath
    await fsp.mkdir(path.dirname(target), { recursive: true })
    await fsp.copyFile(source, target)
    return target
  })

  ipcMain.handle(IPC.FileCleanupJobTemp, async (_event, requestId: string) => {
    assertString(requestId, 'requestId')
    await cleanupJobTemp(requestId)
  })
}