export interface FailedFileInfoInput {
  name: string
  error: string
}

/**
 * Error thrown when a batch engine collects per-file failures. Carries
 * human-readable `message`, optional technical `details`, and the list of
 * affected files so the UI can render them separately.
 */
export class BatchError extends Error {
  readonly failedFiles: FailedFileInfoInput[]
  readonly details?: string

  constructor(
    message: string,
    options?: { failedFiles?: FailedFileInfoInput[]; details?: string; cause?: unknown },
  ) {
    super(message)
    this.name = 'BatchError'
    this.failedFiles = options?.failedFiles ?? []
    this.details = options?.details
    if (options?.cause !== undefined && 'cause' in this) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

export function isBatchError(err: unknown): err is BatchError {
  return err instanceof BatchError
}

export function toFailedFileInfos(files: Array<{ name?: string; error: string }>): FailedFileInfoInput[] {
  return files.map((f) => ({ name: f.name ?? 'Unknown file', error: f.error }))
}