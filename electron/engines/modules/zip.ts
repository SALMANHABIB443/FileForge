import fsp from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { checkAbort, generateOutputName, sanitizeFilename, writeOutput, BatchError } from '../util/common'
import { MAX_ENTRIES, MAX_NESTING_DEPTH, MAX_TOTAL_UNCOMPRESSED, entryUncompressedSize, hasUnsafePath, nestingDepth, writeExtractionManifest, writeZipArchive } from '../util/zip'
import { safeJoin } from '../../security/path-validation'
import type { EngineContext, EngineResult } from '../types'

interface InputFile {
  path: string
  name: string
}

function assertZipInput(file: InputFile): void {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (ext !== 'zip') {
    throw new Error('Select a ZIP file to extract')
  }
}

export async function createZip(
  inputs: InputFile[],
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  if (inputs.length === 0) {
    throw new Error('Select at least one file to create a ZIP')
  }

  const compression = Number(options.level) || 6
  const zip = new JSZip()

  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    checkAbort(ctx.signal)
    ctx.onProgress(Math.round((i / inputs.length) * 50), `Adding ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })
    try {
      const buf = await fsp.readFile(file.path)
      zip.file(file.name, buf)
    } catch (err) {
      if (ctx.signal.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }
  if (failed.length > 0) {
    throw new BatchError(
      `${inputs.length - failed.length} of ${inputs.length} files were added, but ${failed.length} could not be read.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }

  checkAbort(ctx.signal)
  ctx.onProgress(60, 'Compressing…')

  const out = await zip.generateAsync(
    {
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: compression },
    },
    (metadata) => {
      checkAbort(ctx.signal)
      ctx.onProgress(60 + Math.round(metadata.percent * 0.38), 'Compressing…')
    },
  )

  checkAbort(ctx.signal)
  ctx.onProgress(100, 'Done')
  return writeOutput(ctx, generateOutputName(inputs[0]!.name, 'files', 'zip'), out)
}

function shouldExtract(entryName: string, selectedSet: Set<string> | null): boolean {
  if (hasUnsafePath(entryName)) return false
  if (nestingDepth(entryName) > MAX_NESTING_DEPTH) return false
  if (selectedSet && !selectedSet.has(entryName)) return false
  return true
}

export async function extractZip(
  inputs: InputFile[],
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  const file = inputs[0]!
  assertZipInput(file)

  ctx.onProgress(10, 'Reading ZIP…')
  checkAbort(ctx.signal)
  const buf = await fsp.readFile(file.path)
  const zip = await JSZip.loadAsync(buf)

  const entries = Object.values(zip.files)
  const skipped: string[] = []

  let totalSize = 0
  let kept = 0
  for (const entry of entries) {
    if (entry.dir) continue
    if (entries.length > MAX_ENTRIES) {
      throw new Error(`ZIP contains too many entries (${entries.length}) — aborted for safety`)
    }
    if (hasUnsafePath(entry.name)) {
      skipped.push(entry.name)
      continue
    }
    if (nestingDepth(entry.name) > MAX_NESTING_DEPTH) {
      skipped.push(`${entry.name} (too deeply nested)`)
      continue
    }
    totalSize += entryUncompressedSize(entry)
    if (totalSize > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('ZIP exceeds the safe extraction limit — aborted for safety')
    }
    kept++
  }
  checkAbort(ctx.signal)

  if (kept === 0) {
    throw new Error('No safe files found in this ZIP')
  }

  const selectedEntries = options.selectedEntries as string[] | undefined
  const isFiltered = Array.isArray(selectedEntries) && 'selectedEntries' in options
  const selectedSet = isFiltered ? new Set(selectedEntries) : null

  const extractable = entries.filter((e) => !e.dir && shouldExtract(e.name, selectedSet))

  if (extractable.length === 0) {
    throw new Error(isFiltered ? 'No selected files to extract' : 'No safe files found in this ZIP')
  }

  let extractTotalSize = 0
  for (const e of extractable) {
    extractTotalSize += entryUncompressedSize(e)
    if (extractTotalSize > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('ZIP exceeds the safe extraction limit — aborted for safety')
    }
  }

  const desktopOutputDir = typeof options.outputDir === 'string' ? options.outputDir : undefined

  if (desktopOutputDir) {
    ctx.onProgress(30, 'Extracting to chosen folder…')
    const root = path.resolve(desktopOutputDir)
    let current = 0
    for (const entry of extractable) {
      checkAbort(ctx.signal)
      current++
      ctx.onProgress(30 + Math.round((current / extractable.length) * 60), `Extracting ${entry.name}…`, {
        index: current,
        total: extractable.length,
      })
      const data = await entry.async('nodebuffer')
      const target = safeJoin(root, entry.name)
      await fsp.mkdir(path.dirname(target), { recursive: true })
      await fsp.writeFile(target, data)
    }
    ctx.onProgress(100, 'Done')
    return writeExtractionManifest(
      ctx,
      {
        title: 'FileForge extraction report',
        files: extractable.map((e) => ({ name: e.name, size: entryUncompressedSize(e) })),
        skipped,
        destination: root,
        fallback: false,
      },
      file.name,
    )
  }

  // Fallback: re-package extracted files into a safe ZIP
  ctx.onProgress(30, 'Preparing files…')
  const entriesToZip: { name: string; data: Buffer }[] = []
  let current = 0
  for (const entry of extractable) {
    checkAbort(ctx.signal)
    current++
    ctx.onProgress(30 + Math.round((current / extractable.length) * 50), `Processing ${entry.name}…`, {
      index: current,
      total: extractable.length,
    })
    const data = await entry.async('nodebuffer')
    entriesToZip.push({ name: sanitizeFilename(entry.name), data })
  }

  ctx.onProgress(85, 'Packaging…')
  const manifest = await writeExtractionManifest(
    ctx,
    {
      title: 'FileForge extraction report',
      files: extractable.map((e) => ({ name: e.name, size: entryUncompressedSize(e) })),
      skipped,
      destination: sanitizeFilename(file.name.replace(/\.[^.]+$/, '') + '_extracted'),
      fallback: true,
    },
    file.name,
  )
  ctx.onProgress(87, 'Writing report…')
  const report = await fsp.readFile(manifest.outputPath)
  entriesToZip.push({ name: '_extraction_report.txt', data: report })

  const result = await writeZipArchive(ctx, entriesToZip, file.name, 'extracted', 6)
  ctx.onProgress(100, 'Done')
  return result
}