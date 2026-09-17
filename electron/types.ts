export interface SelectedFileInfo {
  path: string
  name: string
  size: number
  lastModified: number
}

export interface SelectFolderResult {
  path: string
  name: string
}

export interface StatInfo {
  path: string
  name: string
  size: number
  isFile: boolean
  isDirectory: boolean
  lastModified: number
}

export interface WriteFileRequest {
  path: string
  data: ArrayBuffer | Uint8Array
}

export interface ExtractWriteRequest {
  root: string
  entryPath: string
  data: ArrayBuffer | Uint8Array
}

export interface SaveOutputRequest {
  data: ArrayBuffer | Uint8Array
  suggestedName: string
  outputDir?: string
  overwriteMode?: OverwriteMode
}

export type SavedLocation = 'outputDir' | 'inputFolder' | 'temp'

export interface SaveOutputResult {
  path: string
  location: SavedLocation
}

export interface SaveAsOutputRequest {
  data: ArrayBuffer | Uint8Array
  suggestedName: string
  defaultDir?: string
}

export interface SaveOutputFileRequest {
  sourcePath: string
  suggestedName: string
  outputDir?: string
  overwriteMode?: OverwriteMode
}

export interface SaveAsFileRequest {
  sourcePath: string
  suggestedName: string
  defaultDir?: string
}

export interface EngineInputFile {
  path: string
  name: string
  size: number
  lastModified?: number
}

export type OverwriteMode = 'autorename' | 'confirm'

export interface OpenPathResult {
  ok: boolean
  error?: string
}

export interface ShellActionResult {
  ok: boolean
}

export interface NotifyRequest {
  title: string
  body: string
}

export interface NotifyResult {
  ok: boolean
  supported: boolean
}

export interface UpdateReleaseNote {
  version: string
  note: string
}

export type UpdateStatus =
  | { type: 'dev' }
  | { type: 'checking' }
  | { type: 'notAvailable' }
  | { type: 'available'; version: string; releaseNotes?: string; releaseDate?: string }
  | {
      type: 'downloading'
      percent: number
      transferred: number
      total: number
      bytesPerSecond: number
    }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

export interface EngineRunRequest {
  requestId: string
  kind: string
  files: EngineInputFile[]
  options: Record<string, unknown>
}

export interface EngineFileResult {
  kind: 'file'
  filename: string
  outputPath: string
  outputSize: number
}

export interface EngineDataResult {
  kind: 'data'
  data: unknown
}

export type EngineRunResult = EngineFileResult | EngineDataResult

export interface EngineProgressEvent {
  requestId: string
  percent: number
  message?: string
  detail?: {
    index?: number
    total?: number
  }
}

export type EngineKind =
  | 'image.convert'
  | 'image.compress'
  | 'image.resize'
  | 'image.crop'
  | 'pdf.imagesToPdf'
  | 'pdf.merge'
  | 'pdf.split'
  | 'pdf.compress'
  | 'pdf.organize'
  | 'pdf.toImages'
  | 'zip.create'
  | 'zip.extract'
  | 'tar.extract'
  | 'rename.batch'
  | 'ffmpeg.extractAudio'
  | 'ffmpeg.convertAudio'
  | 'ffmpeg.compressVideo'
  | 'fileInfo'
  | 'duplicates'
  | 'computeHash'

export interface FileForgeApi {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, callback: (...args: unknown[]) => void): () => void
  getVersion(): Promise<string>
  getPlatform(): Promise<string>
  minimize(): Promise<void>
  maximize(): Promise<boolean>
  close(): Promise<void>
  isMaximized(): Promise<boolean>
  onMaximizeChange(callback: (isMaximized: boolean) => void): () => void
  selectFiles(): Promise<SelectedFileInfo[]>
  selectFolder(): Promise<SelectFolderResult | null>
  saveAsOutput(request: SaveAsOutputRequest): Promise<string | null>
  readFile(path: string): Promise<ArrayBuffer>
  writeFile(request: WriteFileRequest): Promise<string>
  extractWrite(request: ExtractWriteRequest): Promise<string>
  statFile(path: string): Promise<StatInfo | null>
  approvePaths(paths: string[]): Promise<number>
  clearApprovals(): Promise<void>
  getTempDir(): Promise<string>
  saveOutput(request: SaveOutputRequest): Promise<SaveOutputResult | null>
  saveOutputFile(request: SaveOutputFileRequest): Promise<SaveOutputResult | null>
  saveAsFile(request: SaveAsFileRequest): Promise<string | null>
  cleanupJobTemp(requestId: string): Promise<void>
  openFile(filePath: string): Promise<OpenPathResult>
  showItemInFolder(filePath: string): Promise<ShellActionResult>
  notify(request: NotifyRequest): Promise<NotifyResult>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  installAndRestart(): Promise<void>
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void
  runEngine(request: EngineRunRequest): Promise<EngineRunResult>
  cancelEngine(requestId: string): Promise<void>
  onEngineProgress(callback: (event: EngineProgressEvent) => void): () => void
  getPathForFile(file: File): string
}