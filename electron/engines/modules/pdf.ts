import fsp from 'node:fs/promises'
import { checkAbort, generateOutputName, writeOutput, BatchError } from '../util/common'
import { writeZipArchive } from '../util/zip'
import type { EngineContext, EngineFileResult, EngineResult } from '../types'

async function readBytes(ctx: EngineContext, filePath: string): Promise<Uint8Array> {
  checkAbort(ctx.signal)
  const buf = await fsp.readFile(filePath)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

async function loadPdf(bytes: Uint8Array, filename: string): Promise<import('pdf-lib').PDFDocument> {
  const { PDFDocument } = await import('pdf-lib')
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
      throw new Error(`"${filename}" is password-protected and cannot be processed`, { cause: err })
    }
    throw new Error(`"${filename}" is not a valid PDF`, { cause: err })
  }
}

export async function imagesToPdf(
  inputs: { path: string; name: string }[],
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const pageSize = String(options.pageSize ?? 'fit')
  const orientation = String(options.orientation ?? 'portrait')
  const margin = Math.max(0, Math.min(96, Number(options.margin) || 24))

  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    checkAbort(ctx.signal)
    ctx.onProgress((i / inputs.length) * 90, `Adding ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })

    try {
      const bytes = await readBytes(ctx, file.path)
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()

      let image: import('pdf-lib').PDFImage
      if (ext === 'png') {
        image = await pdf.embedPng(bytes)
      } else if (ext === 'jpg' || ext === 'jpeg') {
        image = await pdf.embedJpg(bytes)
      } else {
        throw new Error(`Unsupported image type "${ext}" for PDF — convert to JPG or PNG first`)
      }

      const imgW = image.width
      const imgH = image.height

      let pageW = imgW
      let pageH = imgH

      if (pageSize === 'a4') {
        pageW = 595.28
        pageH = 841.89
      } else if (pageSize === 'letter') {
        pageW = 612
        pageH = 792
      }

      if (orientation === 'landscape' && pageH > pageW) {
        const tmp = pageW
        pageW = pageH
        pageH = tmp
      }
      if (orientation === 'portrait' && pageW > pageH) {
        const tmp = pageW
        pageW = pageH
        pageH = tmp
      }

      const page = pdf.addPage([pageW, pageH])

      const availW = Math.max(1, pageW - margin * 2)
      const availH = Math.max(1, pageH - margin * 2)
      const scale = Math.min(availW / imgW, availH / imgH)
      const drawW = imgW * scale
      const drawH = imgH * scale
      const x = (pageW - drawW) / 2
      const y = (pageH - drawH) / 2

      page.drawImage(image, { x, y, width: drawW, height: drawH })
    } catch (err) {
      if (ctx.signal.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (pdf.getPageCount() === 0) {
    throw new BatchError(
      `Could not add any of the ${inputs.length} images to the PDF. ${failed[0]?.error ?? ''}`.trim(),
      { failedFiles: failed },
    )
  }
  if (failed.length > 0) {
    throw new BatchError(
      `${pdf.getPageCount()} of ${inputs.length} images were added, but ${failed.length} could not be processed and were skipped.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }

  ctx.onProgress(95, 'Writing PDF…')
  checkAbort(ctx.signal)
  const bytes = await pdf.save()

  ctx.onProgress(100, 'Done')
  return writeOutput(ctx, generateOutputName(inputs[0]?.name ?? 'images', 'document', 'pdf'), bytes)
}

export async function mergePdfs(
  inputs: { path: string; name: string }[],
  _options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  if (inputs.length < 2) {
    throw new Error('Select at least two PDFs to merge')
  }

  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()

  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    checkAbort(ctx.signal)
    ctx.onProgress((i / inputs.length) * 90, `Merging ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })

    try {
      const bytes = await readBytes(ctx, file.path)
      const source = await loadPdf(bytes, file.name)
      const pages = await output.copyPages(source, source.getPageIndices())
      for (const page of pages) {
        output.addPage(page)
      }
    } catch (err) {
      if (ctx.signal.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (failed.length > 0) {
    throw new BatchError(
      `${inputs.length - failed.length} of ${inputs.length} PDFs were merged, but ${failed.length} could not be added.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }

  ctx.onProgress(95, 'Writing PDF…')
  checkAbort(ctx.signal)
  const bytes = await output.save()

  ctx.onProgress(100, 'Done')
  return writeOutput(ctx, generateOutputName(inputs[0]!.name, 'merged', 'pdf'), bytes)
}

export function parseRanges(rangeSpec: string, pageCount: number): number[] {
  const pages = new Set<number>()
  const parts = rangeSpec.split(',').map((p) => p.trim()).filter(Boolean)

  if (parts.length === 0) throw new Error('Enter a page range, e.g. 1-3, 5, 8-10')

  for (const part of parts) {
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(part)
    if (match) {
      const start = Number(match[1])
      const end = Number(match[2])
      if (start < 1 || end > pageCount || start > end) {
        throw new Error(`Range ${part} is outside the document (1-${pageCount})`)
      }
      for (let p = start; p <= end; p++) pages.add(p)
    } else if (/^\d+$/.test(part)) {
      const p = Number(part)
      if (p < 1 || p > pageCount) {
        throw new Error(`Page ${p} is outside the document (1-${pageCount})`)
      }
      pages.add(p)
    } else {
      throw new Error(`Invalid range "${part}"`)
    }
  }

  return Array.from(pages).sort((a, b) => a - b)
}

export function coerceRotation(value: unknown): 0 | 90 | 180 | 270 {
  const n = Number(value)
  if (n === 90 || n === 180 || n === 270) return n as 0 | 90 | 180 | 270
  return 0
}

export async function splitPdf(
  inputs: { path: string; name: string }[],
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  const file = inputs[0]!
  const mode = String(options.mode ?? 'range')
  const bytes = await readBytes(ctx, file.path)
  const source = await loadPdf(bytes, file.name)
  const pageCount = source.getPageCount()

  if (mode === 'every') {
    const { PDFDocument } = await import('pdf-lib')
    ctx.onProgress(5, 'Extracting pages…')
    const entries: { name: string; data: Uint8Array }[] = []
    for (let i = 0; i < pageCount; i++) {
      checkAbort(ctx.signal)
      const doc = await PDFDocument.create()
      const [page] = await doc.copyPages(source, [i])
      doc.addPage(page)
      entries.push({
        name: `${file.name.replace(/\.[^.]+$/, '')}_page_${i + 1}.pdf`,
        data: await doc.save(),
      })
      ctx.onProgress(5 + (i / pageCount) * 90, `Page ${i + 1} of ${pageCount}`, {
        index: i + 1,
        total: pageCount,
      })
    }
    ctx.onProgress(97, 'Writing ZIP…')
    checkAbort(ctx.signal)
    const result = await writeZipArchive(ctx, entries, file.name, 'pages', 6)
    ctx.onProgress(100, 'Done')
    return result
  }

  const { PDFDocument } = await import('pdf-lib')
  const rangeSpec = String(options.range ?? '')
  const pages = parseRanges(rangeSpec, pageCount)

  ctx.onProgress(30, 'Building PDF…')
  const output = await PDFDocument.create()
  for (const pageIndex of pages) {
    checkAbort(ctx.signal)
    const [page] = await output.copyPages(source, [pageIndex - 1])
    output.addPage(page)
  }
  const outputBytes = await output.save()
  ctx.onProgress(100, 'Done')

  return writeOutput(ctx, generateOutputName(file.name, 'split', 'pdf'), outputBytes)
}

export async function compressPdf(
  inputs: { path: string; name: string }[],
  _options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  const file = inputs[0]!
  const bytes = await readBytes(ctx, file.path)
  const source = await loadPdf(bytes, file.name)

  const { PDFDocument } = await import('pdf-lib')
  ctx.onProgress(40, 'Rebuilding document…')
  const output = await PDFDocument.create()
  const pages = await output.copyPages(source, source.getPageIndices())
  for (const page of pages) output.addPage(page)

  ctx.onProgress(75, 'Saving…')
  checkAbort(ctx.signal)
  const saved = await output.save()

  const finalBytes = saved.byteLength < bytes.byteLength ? saved : bytes

  ctx.onProgress(100, 'Done')
  return writeOutput(ctx, generateOutputName(file.name, 'compressed', 'pdf'), finalBytes)
}

export async function organizePdf(
  inputs: { path: string; name: string }[],
  options: Record<string, unknown>,
  ctx: EngineContext,
): Promise<EngineResult> {
  const file = inputs[0]!
  const order = Array.isArray(options.order) ? (options.order as number[]) : undefined
  const rotation = coerceRotation(options.rotation)
  const bytes = await readBytes(ctx, file.path)
  const source = await loadPdf(bytes, file.name)
  const pageCount = source.getPageCount()

  const { PDFDocument, RotationTypes } = await import('pdf-lib')
  const output = await PDFDocument.create()

  const indices =
    order && order.length === pageCount
      ? order
      : Array.from({ length: pageCount }, (_, i) => i)

  ctx.onProgress(20, 'Building document…')
  for (let i = 0; i < indices.length; i++) {
    checkAbort(ctx.signal)
    ctx.onProgress(20 + ((i + 1) / indices.length) * 70, `Page ${i + 1} of ${indices.length}`, {
      index: i + 1,
      total: indices.length,
    })
    const srcIndex = indices[i]!
    const page = (await output.copyPages(source, [srcIndex]))[0]!
    if (rotation !== 0) {
      const current = page.getRotation().angle
      const angle = ((((current + rotation) % 360) + 360) % 360) as 0 | 90 | 180 | 270 | 360
      page.setRotation({ type: RotationTypes.Degrees, angle })
    }
    output.addPage(page)
  }

  ctx.onProgress(95, 'Writing PDF…')
  checkAbort(ctx.signal)
  const outBytes = await output.save()

  ctx.onProgress(100, 'Done')
  return writeOutput(ctx, generateOutputName(file.name, 'organized', 'pdf'), outBytes)
}

export async function pdfPageCountForRange(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  return PDFDocument.load(bytes).then((doc) => doc.getPageCount())
}

export type { EngineFileResult }