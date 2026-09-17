export interface WorkerStartRequest {
  type: 'run'
  requestId: string
  kind: 'image.convert' | 'image.compress' | 'image.resize' | 'image.crop' | 'pdf.toImages' | 'ffmpeg.extractAudio' | 'ffmpeg.convertAudio' | 'ffmpeg.compressVideo'
  files: Array<{ path: string; name: string; size: number }>
  options: Record<string, unknown>
  workDir: string
  ffmpegPath?: string
}

export interface WorkerAbortRequest {
  type: 'abort'
  requestId: string
}

export type WorkerRequest = WorkerStartRequest | WorkerAbortRequest

export interface WorkerProgressMessage {
  type: 'progress'
  requestId: string
  percent: number
  message?: string
  detail?: {
    index?: number
    total?: number
  }
}

export interface WorkerResultMessage {
  type: 'result'
  requestId: string
  result: {
    kind: 'file' | 'data'
    filename?: string
    outputPath?: string
    outputSize?: number
    data?: unknown
  }
}

export interface WorkerErrorMessage {
  type: 'error'
  requestId: string
  message: string
}

export type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage