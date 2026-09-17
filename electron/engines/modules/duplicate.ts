import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { checkAbort } from '../util/common'
import type { EngineContext } from '../types'

export interface DuplicateGroup {
  hash: string
  files: Array<{ name: string; size: number; path: string }>
  size: number
}

async function hashFileStream(filePath: string, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  let consumed = 0
  for await (const chunk of createReadStream(filePath)) {
    checkAbort(signal)
    hash.update(chunk as Buffer)
    consumed += (chunk as Buffer).byteLength
  }
  void consumed
  return hash.digest('hex')
}

export async function findDuplicates(
  files: Array<{ path: string; name: string; size: number }>,
  ctx: EngineContext,
): Promise<DuplicateGroup[]> {
  const hashMap = new Map<string, Array<{ name: string; size: number; path: string }>>()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    checkAbort(ctx.signal)
    ctx.onProgress(Math.round((i / files.length) * 90), `Hashing ${file.name}…`, {
      index: i + 1,
      total: files.length,
    })
    const hash = await hashFileStream(file.path, ctx.signal)
    const group = hashMap.get(hash)
    const meta = { name: file.name, size: file.size, path: file.path }
    if (group) {
      group.push(meta)
    } else {
      hashMap.set(hash, [meta])
    }
  }

  ctx.onProgress(100, 'Done')

  return Array.from(hashMap.entries())
    .filter(([, group]) => group.length > 1)
    .map(([hash, group]) => ({
      hash,
      files: group,
      size: group[0]!.size,
    }))
    .sort((a, b) => b.files.length - a.files.length)
}