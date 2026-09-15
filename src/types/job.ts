export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface FileMeta {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
  handle?: FileSystemFileHandle
  file?: File
}

export interface JobProgress {
  percent: number
  message?: string
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
  outputBlob?: Blob
  outputUrl?: string
}

export interface JobCreateInput {
  toolId: string
  inputs: FileMeta[]
  options?: Record<string, unknown>
  outputName?: string
}
