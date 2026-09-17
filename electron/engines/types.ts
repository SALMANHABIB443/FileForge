export interface EngineInputFile {
  path: string
  name: string
  size: number
}

export type EngineOptions = Record<string, unknown>

export interface EngineProgressDetail {
  index?: number
  total?: number
}

export interface EngineContext {
  workDir: string
  signal: AbortSignal
  onProgress: (percent: number, message?: string, detail?: EngineProgressDetail) => void
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

export type EngineResult = EngineFileResult | EngineDataResult

/**
 * Engine kinds map 1:1 to the tool registry. Heavy engines run in a worker
 * thread, lightweight engines run in the main process.
 */
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

export type EngineFunction = (
  inputs: EngineInputFile[],
  options: EngineOptions,
  ctx: EngineContext,
) => Promise<EngineResult>

export interface EngineRequest {
  requestId: string
  kind: EngineKind
  files: EngineInputFile[]
  options: EngineOptions
}

export interface EngineRequestResult {
  requestId: string
  result?: EngineResult
  error?: string
}