import type { ConversionResult } from '@/types/engine'
import type { FileMeta } from '@/types/job'
import { readFileAsBlob } from '@/services/file-service'
import { generateOutputName } from '@/utils/filename'
import { checkAbort } from '@/utils/abort'
import { zipBlobs } from '@/utils/zip'

export interface RenameResult {
  original: string
  renamed: string
}

export function computeRenames(
  files: FileMeta[],
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
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  if (inputs.length === 0) {
    throw new Error('Select at least one file to rename')
  }

  const renames = computeRenames(inputs, options)

  if (inputs.length === 1) {
    onProgress?.(50, 'Processing…')
    checkAbort(signal!)
    const blob = await readFileAsBlob(inputs[0]!)
    onProgress?.(100, 'Done')
    return {
      blob,
      filename: renames[0]!.renamed,
    }
  }

  onProgress?.(10, 'Building ZIP…')
  const blobs: Array<{ name: string; blob: Blob }> = []

  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    const rename = renames[i]!
    checkAbort(signal!)
    onProgress?.(10 + Math.round((i / inputs.length) * 60), `Processing ${file.name}…`)
    const blob = await readFileAsBlob(file)
    blobs.push({ name: rename.renamed, blob })
  }

  onProgress?.(75, 'Creating ZIP…')
  const result = await zipBlobs(blobs)

  checkAbort(signal!)
  onProgress?.(100, 'Done')

  return {
    blob: result,
    filename: generateOutputName(inputs[0]!.name, 'renamed', 'zip'),
  }
}
