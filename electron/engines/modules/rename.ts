import fsp from 'node:fs/promises'
import { checkAbort, writeOutput, BatchError } from '../util/common'
import { writeZipArchive } from '../util/zip'
import type { EngineContext, EngineResult } from '../types'

export interface RenameResult {
  original: string
  renamed: string
}

export function computeRenames(
  files: Array<{ name: string }>,
  options: Record<string, unknown>,
): RenameResult[] {
  const mode = (options.mode as string) ?? 'prefix'
  const prefix = (options.prefix as string) ?? ''
  const suffix = (options.suffix as string) ?? ''
  const findText = (options.findText as string) ?? ''
  const replaceText = (options.replaceText as string) ?? ''
  const startNumber = Number(options.startNumber) || 1
  const padWidth = Number(options.padWidth) || 3

  return files.map((file, index) => {
    const dot = file.name.lastIndexOf('.')
    const base = dot >= 0 ? file.name.slice(0, dot) : file.name
    const ext = dot >= 0 ? file.name.slice(dot) : ''

    let newBase: string
    switch (mode) {
      case 'prefix':
        newBase = prefix + base
        break
      case 'suffix':
        newBase = base + suffix
        break
      case 'find-replace':
        newBase = findText ? base.split(findText).join(replaceText) : base
        break
      case 'sequential': {
        const num = String(startNumber + index).padStart(padWidth, '0')
        newBase = num + (prefix ? '_' + prefix : '') + (suffix ? '_' + suffix : '')
        break
      }
      default:
        newBase = base
    }

    return {
      original: file.name,
      renamed: newBase + ext,
    }
  })
}

export async function batchRename(
  inputs: Array<{ path: string; name: string }>,
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  if (inputs.length === 0) {
    throw new Error('Select at least one file to rename')
  }

  const renames = computeRenames(inputs, options)

  if (inputs.length === 1) {
    ctx.onProgress(50, 'Processing…')
    checkAbort(ctx.signal)
    const buf = await fsp.readFile(inputs[0]!.path)
    ctx.onProgress(100, 'Done')
    return writeOutput(ctx, renames[0]!.renamed, buf)
  }

  ctx.onProgress(10, 'Building ZIP…')
  const entries: Array<{ name: string; data: Uint8Array | ArrayBuffer | Buffer }> = []
  const failed: Array<{ name: string; error: string }> = []

  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    const rename = renames[i]!
    checkAbort(ctx.signal)
    ctx.onProgress(10 + Math.round((i / inputs.length) * 60), `Processing ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })
    try {
      const buf = await fsp.readFile(file.path)
      entries.push({ name: rename.renamed, data: buf })
    } catch (err) {
      if (ctx.signal.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (entries.length === 0) {
    throw new BatchError(`Could not read any of the ${inputs.length} files. ${failed[0]?.error ?? ''}`.trim(), {
      failedFiles: failed,
    })
  }
  if (failed.length > 0) {
    throw new BatchError(`${failed.length} of ${inputs.length} files could not be read and were skipped.`, {
      failedFiles: failed,
    })
  }

  ctx.onProgress(75, 'Creating ZIP…')
  checkAbort(ctx.signal)
  const result = await writeZipArchive(ctx, entries, inputs[0]!.name, 'renamed')

  ctx.onProgress(100, 'Done')
  return result
}