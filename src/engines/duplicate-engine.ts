import type { FileMeta, JobProgressDetail } from '@/types/job'
import { readFileAsBlob } from '@/services/file-service'

export interface DuplicateGroup {
  hash: string
  files: FileMeta[]
  size: number
}

async function hashFile(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function findDuplicates(
  files: FileMeta[],
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
): Promise<DuplicateGroup[]> {
  const hashMap = new Map<string, FileMeta[]>()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    onProgress?.(Math.round((i / files.length) * 90), `Hashing ${file.name}…`, {
      index: i + 1,
      total: files.length,
    })
    const blob = await readFileAsBlob(file)
    const hash = await hashFile(blob)
    const group = hashMap.get(hash)
    if (group) {
      group.push(file)
    } else {
      hashMap.set(hash, [file])
    }
  }

  onProgress?.(100, 'Done')

  return Array.from(hashMap.entries())
    .filter(([, group]) => group.length > 1)
    .map(([hash, group]) => ({
      hash,
      files: group,
      size: group[0]!.size,
    }))
    .sort((a, b) => b.files.length - a.files.length)
}
