import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../channels'
import type { UpdateStatus } from '../types'
import {
  createMockUpdaterDriver,
  createRealUpdaterDriver,
  createUpdaterController,
  type UpdaterController,
  type UpdaterDriver,
} from '../services/updater'

let controllerPromise: Promise<UpdaterController> | null = null

function assertNoArgs(args: readonly unknown[]): void {
  if (args.length > 0) throw new Error('This channel does not accept arguments')
}

async function resolveDriver(): Promise<UpdaterDriver | null> {
  if (app.isPackaged) return createRealUpdaterDriver()
  if (process.env['FILEFORGE_UPDATER_MOCK'] === '1') {
    const errorMode = process.env['FILEFORGE_UPDATER_MOCK_ERR']
    return createMockUpdaterDriver({
      failCheck: errorMode === 'check',
      failDownload: errorMode === 'download',
      releaseNotes: 'Mock release notes for FileForge phase 13 verification.',
    })
  }
  return null
}

function getController(): Promise<UpdaterController> {
  if (!controllerPromise) {
    controllerPromise = resolveDriver().then(createUpdaterController)
  }
  return controllerPromise
}

function broadcast(status: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(IPC.UpdateStatus, status)
    }
  }
}

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC.UpdateCheck, async (_event, ...args: unknown[]) => {
    assertNoArgs(args)
    const controller = await getController()
    controller.subscribe(broadcast)
    await controller.check()
  })

  ipcMain.handle(IPC.UpdateDownload, async (_event, ...args: unknown[]) => {
    assertNoArgs(args)
    const controller = await getController()
    controller.subscribe(broadcast)
    await controller.download()
  })

  ipcMain.handle(IPC.UpdateInstall, async (_event, ...args: unknown[]) => {
    assertNoArgs(args)
    const controller = await getController()
    controller.subscribe(broadcast)
    await controller.install()
  })
}

/** Test helper — clears the cached controller so driver selection can change. */
export function resetUpdaterControllerForTests(): void {
  controllerPromise = null
}