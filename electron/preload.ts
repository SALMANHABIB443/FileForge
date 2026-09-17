import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from './channels'
import type {
  EngineProgressEvent,
  EngineRunRequest,
  ExtractWriteRequest,
  FileForgeApi,
  NotifyRequest,
  SaveAsFileRequest,
  SaveAsOutputRequest,
  SaveOutputFileRequest,
  SaveOutputRequest,
  UpdateStatus,
  WriteFileRequest,
} from './types'

function subscribe(channel: string, callback: (...args: unknown[]) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]): void => {
    callback(...args)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: FileForgeApi = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => subscribe(channel, callback),
  getVersion: () => ipcRenderer.invoke(IPC.AppGetVersion),
  getPlatform: () => ipcRenderer.invoke(IPC.AppGetPlatform),
  minimize: () => ipcRenderer.invoke(IPC.WindowMinimize),
  maximize: () => ipcRenderer.invoke(IPC.WindowMaximize),
  close: () => ipcRenderer.invoke(IPC.WindowClose),
  isMaximized: () => ipcRenderer.invoke(IPC.WindowIsMaximized),
  onMaximizeChange: (callback) =>
    subscribe(IPC.WindowMaximizeChange, (isMaximized) => callback(Boolean(isMaximized))),
  selectFiles: () => ipcRenderer.invoke(IPC.FileSelectFiles),
  selectFolder: () => ipcRenderer.invoke(IPC.FileSelectFolder),
  saveAsOutput: (request: SaveAsOutputRequest) => ipcRenderer.invoke(IPC.FileSaveAs, request),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FileRead, filePath),
  writeFile: (request: WriteFileRequest) => ipcRenderer.invoke(IPC.FileWrite, request),
  extractWrite: (request: ExtractWriteRequest) => ipcRenderer.invoke(IPC.FileExtractWrite, request),
  statFile: (filePath: string) => ipcRenderer.invoke(IPC.FileStat, filePath),
  approvePaths: (paths: string[]) => ipcRenderer.invoke(IPC.FileApprovePaths, paths),
  clearApprovals: () => ipcRenderer.invoke(IPC.FileClearApprovals),
  getTempDir: () => ipcRenderer.invoke(IPC.FileGetTempDir),
  saveOutput: (request: SaveOutputRequest) => ipcRenderer.invoke(IPC.FileSaveOutput, request),
  saveOutputFile: (request: SaveOutputFileRequest) =>
    ipcRenderer.invoke(IPC.FileSaveOutputFile, request),
  saveAsFile: (request: SaveAsFileRequest) => ipcRenderer.invoke(IPC.FileSaveAsFile, request),
  cleanupJobTemp: (requestId: string) => ipcRenderer.invoke(IPC.FileCleanupJobTemp, requestId),
  openFile: (filePath: string) => ipcRenderer.invoke(IPC.ShellOpenPath, filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke(IPC.ShellShowItemInFolder, filePath),
  notify: (request: NotifyRequest) => ipcRenderer.invoke(IPC.NotifyShow, request),
  checkForUpdates: () => ipcRenderer.invoke(IPC.UpdateCheck),
  downloadUpdate: () => ipcRenderer.invoke(IPC.UpdateDownload),
  installAndRestart: () => ipcRenderer.invoke(IPC.UpdateInstall),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) =>
    subscribe(IPC.UpdateStatus, (status) => callback(status as UpdateStatus)),
  runEngine: (request: EngineRunRequest) => ipcRenderer.invoke(IPC.EngineRun, request),
  cancelEngine: (requestId: string) => ipcRenderer.invoke(IPC.EngineCancel, requestId),
  onEngineProgress: (callback: (event: EngineProgressEvent) => void) =>
    subscribe(IPC.EngineProgress, (event) => callback(event as EngineProgressEvent)),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
}

contextBridge.exposeInMainWorld('fileforge', api)