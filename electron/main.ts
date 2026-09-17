import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc/index'
import { shutdownHeavyPool } from './engines/pool'
import { IPC } from './channels'
import { setTempBase, ensureTempBase, cleanupOrphanedTemps } from './services/temp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'FileForge',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FAF9F7',
    ...(!app.isPackaged ? { icon: path.join(__dirname, '../../build/icon.ico') } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send(IPC.WindowMaximizeChange, true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send(IPC.WindowMaximizeChange, false)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    setTempBase(app.getPath('temp'))
    await ensureTempBase()
    await cleanupOrphanedTemps().catch(() => {})
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('will-quit', () => {
    shutdownHeavyPool()
  })
}