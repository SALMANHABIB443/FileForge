import type { PDFImage } from 'pdf-lib'
import type { ConversionResult } from '@/types/engine'
import type { FileMeta, JobProgressDetail } from '@/types/job'
import { readFileAsBlob } from '@/services/file-service'
import { generateOutputName, getFileExtension } from '@/utils/filename'
import { checkAbort } from '@/utils/abort'
import { zipBlobs } from '@/utils/zip'
import { BatchError } from '@/utils/batch-error'

async function readBytes(file: FileMeta): Promise<Uint8Array> {
  const blob = await readFileAsBlob(file)
  const ab = await blob.arrayBuffer()
  return new Uint8Array(ab)
}

async function loadPdf(
  bytes: Uint8Array,
  filename: string,
): Promise<import('pdf-lib').PDFDocument> {
  const { PDFDocument } = await import('pdf-lib')
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
      throw withCause(`"${filename}" is password-protected and cannot be processed`, err)
    }
    throw withCause(`"${filename}" is not a valid PDF`, err)
  }
}

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message) as Error & { cause?: unknown }
  error.cause = cause
  return error
}

export async function imagesToPdf(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const pageSize = String(options.pageSize ?? 'fit')
  const orientation = String(options.orientation ?? 'portrait')
  const margin = Math.max(0, Math.min(96, Number(options.margin) || 24))

  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    checkAbort(signal!)
    onProgress?.((i / inputs.length) * 90, `Adding ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })

    try {
      const bytes = await readBytes(file)
      const ext = getFileExtension(file.name)

      let image: PDFImage
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
      if (signal?.aborted) throw err
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

  onProgress?.(95, 'Writing PDF…')
  checkAbort(signal!)
  const bytes = await pdf.save()

  onProgress?.(100, 'Done')
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: generateOutputName(inputs[0]?.name ?? 'images', 'document', 'pdf'),
  }
}

export async function mergePdfs(
  inputs: FileMeta[],
  _options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  if (inputs.length < 2) {
    throw new Error('Select at least two PDFs to merge')
  }

  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()

  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const file = inputs[i]!
    checkAbort(signal!)
    onProgress?.((i / inputs.length) * 90, `Merging ${file.name}…`, {
      index: i + 1,
      total: inputs.length,
    })

    try {
      const bytes = await readBytes(file)
      const source = await loadPdf(bytes, file.name)
      const pages = await output.copyPages(source, source.getPageIndices())
      for (const page of pages) {
        output.addPage(page)
      }
    } catch (err) {
      if (signal?.aborted) throw err
      failed.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (failed.length > 0) {
    throw new BatchError(
      `${inputs.length - failed.length} of ${inputs.length} PDFs were merged, but ${failed.length} could not be added.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }

  onProgress?.(95, 'Writing PDF…')
  checkAbort(signal!)
  const bytes = await output.save()

  onProgress?.(100, 'Done')
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: generateOutputName(inputs[0]!.name, 'merged', 'pdf'),
  }
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

export async function splitPdf(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = inputs[0]!
  const mode = String(options.mode ?? 'range')
  const bytes = await readBytes(file)
  const source = await loadPdf(bytes, file.name)
  const pageCount = source.getPageCount()

  if (mode === 'every') {
    const { PDFDocument } = await import('pdf-lib')
    onProgress?.(5, 'Extracting pages…')
    const entries: { name: string; blob: Uint8Array }[] = []
    for (let i = 0; i < pageCount; i++) {
      checkAbort(signal!)
      const doc = await PDFDocument.create()
      const [page] = await doc.copyPages(source, [i])
      doc.addPage(page)
      const pageBytes = await doc.save()
      entries.push({ name: `${file.name.replace(/\.[^.]+$/, '')}_page_${i + 1}.pdf`, blob: pageBytes })
      onProgress?.(5 + (i / pageCount) * 90, `Page ${i + 1} of ${pageCount}`, {
        index: i + 1,
        total: pageCount,
      })
    }
    onProgress?.(97, 'Writing ZIP…')
    checkAbort(signal!)
    const blob = await zipBlobs(entries)
    onProgress?.(100, 'Done')
    return {
      blob,
      filename: generateOutputName(file.name, 'pages', 'zip'),
    }
  }

  const { PDFDocument } = await import('pdf-lib')
  const rangeSpec = String(options.range ?? '')
  const pages = parseRanges(rangeSpec, pageCount)

  onProgress?.(30, 'Building PDF…')
  const output = await PDFDocument.create()
  for (const pageIndex of pages) {
    checkAbort(signal!)
    const [page] = await output.copyPages(source, [pageIndex - 1])
    output.addPage(page)
  }
  const outputBytes = await output.save()
  onProgress?.(100, 'Done')

  return {
    blob: new Blob([outputBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: generateOutputName(file.name, 'split', 'pdf'),
  }
}

export async function compressPdf(
  inputs: FileMeta[],
  _options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = inputs[0]!
  const bytes = await readBytes(file)
  const source = await loadPdf(bytes, file.name)

  const { PDFDocument } = await import('pdf-lib')
  onProgress?.(40, 'Rebuilding document…')
  const output = await PDFDocument.create()
  const pages = await output.copyPages(source, source.getPageIndices())
  for (const page of pages) output.addPage(page)

  onProgress?.(75, 'Saving…')
  checkAbort(signal!)
  const saved = await output.save()

  let finalBytes: Uint8Array
  if (saved.byteLength < bytes.byteLength) {
    finalBytes = saved
  } else {
    finalBytes = bytes
  }

  onProgress?.(100, 'Done')
  return {
    blob: new Blob([finalBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: generateOutputName(file.name, 'compressed', 'pdf'),
  }
}

export async function pdfPageCountForRange(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  return PDFDocument.load(bytes).then((doc) => doc.getPageCount())
}

export async function organizePdf(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = inputs[0]!
  const order = Array.isArray(options.order) ? (options.order as number[]) : undefined
  const rotation = coerceRotation(options.rotation)
  const bytes = await readBytes(file)
  const source = await loadPdf(bytes, file.name)
  const pageCount = source.getPageCount()

  const { PDFDocument, RotationTypes } = await import('pdf-lib')
  const output = await PDFDocument.create()

  const indices =
    order && order.length === pageCount
      ? order
      : Array.from({ length: pageCount }, (_, i) => i)

  onProgress?.(20, 'Building document…')
  for (let i = 0; i < indices.length; i++) {
    checkAbort(signal!)
    onProgress?.(20 + ((i + 1) / indices.length) * 70, `Page ${i + 1} of ${indices.length}`, {
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

  onProgress?.(95, 'Writing PDF…')
  checkAbort(signal!)
  const outBytes = await output.save()

  onProgress?.(100, 'Done')
  return {
    blob: new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: generateOutputName(file.name, 'organized', 'pdf'),
  }
}

export function coerceRotation(value: unknown): 0 | 90 | 180 | 270 {
  const n = Number(value)
  if (n === 90 || n === 180 || n === 270) return n as 0 | 90 | 180 | 270
  return 0
}

const MAX_PDFJS_PAGES = 200

export async function pdfToImages(
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string, detail?: JobProgressDetail) => void,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const file = inputs[0]!
  const format = options.format === 'png' ? 'png' : 'jpeg'
  const scale = Number(options.scale) || 2
  const rawQuality = Number(options.quality) || 92
  const quality = rawQuality > 1 ? rawQuality / 100 : rawQuality
  const rangeSpec = String(options.range ?? '').trim()

  onProgress?.(2, 'Loading document…')
  checkAbort(signal!)
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const bytes = await readBytes(file)
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise
  checkAbort(signal!)

  const pageCount = doc.numPages
  if (pageCount > MAX_PDFJS_PAGES) {
    throw new Error(`This PDF has ${pageCount} pages — the limit for this tool is ${MAX_PDFJS_PAGES} pages.`)
  }

  const pageIndices =
    rangeSpec === ''
      ? Array.from({ length: pageCount }, (_, i) => i + 1)
      : parseRanges(rangeSpec, pageCount)

  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const ext = format === 'png' ? 'png' : 'jpg'

  const processPage = async (pageNum: number): Promise<{ name: string; blob: Blob }> => {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to render page'))), mime, quality)
    })
    return { name: `${file.name.replace(/\.[^.]+$/, '')}_page_${pageNum}.${ext}`, blob }
  }

  if (pageIndices.length === 1) {
    onProgress?.(50, `Rendering page ${pageIndices[0]}…`, { index: 1, total: pageIndices.length })
    const { name, blob } = await processPage(pageIndices[0]!)
    checkAbort(signal!)
    onProgress?.(100, 'Done')
    return { blob, filename: name }
  }

  const entries: { name: string; blob: Blob }[] = []
  const failed: Array<{ name: string; error: string }> = []
  for (let i = 0; i < pageIndices.length; i++) {
    checkAbort(signal!)
    const pageNum = pageIndices[i]!
    onProgress?.(5 + (i / pageIndices.length) * 90, `Rendering page ${pageNum}…`, {
      index: i + 1,
      total: pageIndices.length,
    })
    try {
      const { name, blob } = await processPage(pageNum)
      entries.push({ name, blob })
    } catch (err) {
      if (signal?.aborted) throw err
      failed.push({ name: `Page ${pageNum}`, error: err instanceof Error ? err.message : String(err) })
    }
  }
  if (failed.length > 0) {
    throw new BatchError(
      `${entries.length} of ${pageIndices.length} pages were rendered, but ${failed.length} could not be.`,
      { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
    )
  }
  onProgress?.(96, 'Writing ZIP…')
  checkAbort(signal!)
  const zipBlob = await zipBlobs(entries)

  onProgress?.(100, 'Done')
  return {
    blob: zipBlob,
    filename: generateOutputName(file.name, 'pages', 'zip'),
  }
}