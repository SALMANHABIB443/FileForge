export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface FileMeta {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
  handle?: FileSystemFileHandle
  file?: File
  path?: string
}

export interface JobProgressDetail {
  index?: number
  total?: number
}

export interface JobProgress {
  percent: number
  message?: string
  index?: number
  total?: number
}

export interface FailedFileInfo {
  name: string
  error: string
}

export interface Job {
  id: string
  toolId: string
  status: JobStatus
  inputs: FileMeta[]
  outputName?: string
  options: Record<string, unknown>
  progress: JobProgress
  createdAt: number
  updatedAt: number
  error?: string
  errorDetails?: string
  failedFiles?: FailedFileInfo[]
  retryCount?: number
  interrupted?: boolean
  outputBlob?: Blob
  outputUrl?: string
  outputPath?: string
  outputSize?: number
  savedPath?: string
}

export interface JobCreateInput {
  toolId: string
  inputs: FileMeta[]
  options?: Record<string, unknown>
  outputName?: string
  id?: string
  createdAt?: number
  retryCount?: number
  interrupted?: boolean
}
