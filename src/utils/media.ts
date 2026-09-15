import { formatFileSize } from '@/utils/filename'

export const SOFT_WARN_BYTES = 200 * 1024 * 1024
export const HARD_LIMIT_BYTES = 1024 * 1024 * 1024

export function getMediaFileWarnings(sizeBytes: number): string | null {
  if (sizeBytes > HARD_LIMIT_BYTES) {
    return `This file is ${formatFileSize(sizeBytes)} — larger than the supported limit of ${formatFileSize(HARD_LIMIT_BYTES)}. Pick a smaller file.`
  }
  if (sizeBytes > SOFT_WARN_BYTES) {
    return `This is a large file (${formatFileSize(sizeBytes)}). Conversion runs entirely in your browser memory, so it can take a while and may be slow on low-RAM devices.`
  }
  return null
}

export function assertMediaSizeAllowed(sizeBytes: number): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('The file appears to be empty or corrupted')
  }
  if (sizeBytes > HARD_LIMIT_BYTES) {
    throw new Error(
      `This file is ${formatFileSize(sizeBytes)} — larger than the supported limit of ${formatFileSize(HARD_LIMIT_BYTES)}. Pick a smaller file.`,
    )
  }
}