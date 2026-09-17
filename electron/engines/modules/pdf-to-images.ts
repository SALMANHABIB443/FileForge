import fsp from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { checkAbort, writeOutput, BatchError } from '../util/common'
import { writeZipArchive } from '../util/zip'
import { parseRanges } from './pdf'
import type { EngineContext, EngineResult } from '../types'

const MAX_PDFJS_PAGES = 200

interface CanvasEntry {
  canvas: import('@napi-rs/canvas').Canvas
  context: import('@napi-rs/canvas').CanvasRenderingContext2D
}

interface NodeCanvasFactoryResult {
  canvasFactory: new (options?: { enableHWA?: boolean }) => {
    create(w: number, h: number): CanvasEntry
    reset(cnv: CanvasEntry, width: number, height: number): void
    destroy(cnv: CanvasEntry): void
  }
  createCanvas(w: number, h: number): import('@napi-rs/canvas').Canvas
}

async function installCanvasShims(): Promise<NodeCanvasFactoryResult> {
  const canvas = await import('@napi-rs/canvas')
  ;(globalThis as { DOMMatrix: unknown }).DOMMatrix = canvas.DOMMatrix
  ;(globalThis as { ImageData: unknown }).ImageData = canvas.ImageData
  ;(globalThis as { Path2D: unknown }).Path2D = canvas.Path2D
  const createCanvas = (w: number, h: number): import('@napi-rs/canvas').Canvas => canvas.createCanvas(w, h)

  class NapiCanvasFactory {
    constructor() {}
    create(w: number, h: number): CanvasEntry {
      if (w <= 0 || h <= 0) throw new Error('Invalid canvas size')
      const c = canvas.createCanvas(w, h)
      return { canvas: c, context: c.getContext('2d') }
    }
    reset(cnv: CanvasEntry, width: number, height: number): void {
      if (!cnv || !cnv.canvas) throw new Error('Canvas is not specified')
      if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')
      cnv.canvas.width = width
      cnv.canvas.height = height
    }
    destroy(cnv: CanvasEntry): void {
      if (!cnv || !cnv.canvas) throw new Error('Canvas is not specified')
      cnv.canvas.width = 0
      cnv.canvas.height = 0
      cnv.canvas = null as unknown as import('@napi-rs/canvas').Canvas
      cnv.context = null as unknown as import('@napi-rs/canvas').CanvasRenderingContext2D
    }
  }

  return {
    createCanvas,
    canvasFactory: NapiCanvasFactory,
  }
}

async function installFetchShim(): Promise<void> {
  const nodeFetch = globalThis.fetch
  const origURL = globalThis.URL
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw: string =
      typeof input === 'string'
        ? input
        : input instanceof origURL
          ? input.href
          : String(input)
    if (raw.startsWith('file:')) {
      const filePath = decodeURIComponent(new origURL(raw).pathname.replace(/^\//, ''))
      const buf = await fsp.readFile(filePath)
      return new Response(buf, { status: 200 })
    }
    return nodeFetch(input, init)
  }
}

async function resolvePdfjsBase(): Promise<string> {
  const requireFromMain = createRequire(import.meta.url)
  const entry = requireFromMain.resolve('pdfjs-dist/legacy/build/pdf.mjs')
  return path.resolve(path.dirname(entry).replace(/[\\/]legacy[\\/]build$/, ''))
}

export async function pdfToImages(
  ctx: EngineContext,
  inputs: Array<{ path: string; name: string }>,
  options: Record<string, unknown>,
): Promise<EngineResult> {
  const file = inputs[0]!
  const format = options.format === 'png' ? 'png' : 'jpeg'
  const scale = Number(options.scale) || 2
  const rawQuality = Number(options.quality) || 92
  const quality = rawQuality > 1 ? rawQuality / 100 : rawQuality
  const rangeSpec = String(options.range ?? '').trim()

  ctx.onProgress(2, 'Loading document…')
  checkAbort(ctx.signal)

  const { canvasFactory, createCanvas } = await installCanvasShims()
  await installFetchShim()

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
  const pdfjsBase = await resolvePdfjsBase()
  const standardFontDataUrl = pathToFileURL(path.join(pdfjsBase, 'standard_fonts') + path.sep).href

  checkAbort(ctx.signal)
  const buf = await fsp.readFile(file.path)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    standardFontDataUrl,
    CanvasFactory: canvasFactory,
  } as never)
  const doc = await loadingTask.promise
  checkAbort(ctx.signal)

  const pageCount = doc.numPages
  if (pageCount > MAX_PDFJS_PAGES) {
    await loadingTask.destroy()
    ctx.onProgress(100, 'Done')
    throw new Error(`This PDF has ${pageCount} pages — the limit for this tool is ${MAX_PDFJS_PAGES} pages.`)
  }

  const pageIndices =
    rangeSpec === ''
      ? Array.from({ length: pageCount }, (_, i) => i + 1)
      : parseRanges(rangeSpec, pageCount)

  const ext = format === 'png' ? 'png' : 'jpg'

  const processPage = async (pageNum: number): Promise<{ name: string; data: Buffer }> => {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(viewport.width, viewport.height)
    const canvasContext = canvas.getContext('2d')
    await page
      .render({
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        viewport,
      })
      .promise
    checkAbort(ctx.signal)
    const data =
      format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', quality * 100)
    return {
      name: `${file.name.replace(/\.[^.]+$/, '')}_page_${pageNum}.${ext}`,
      data,
    }
  }

  try {
    if (pageIndices.length === 1) {
      ctx.onProgress(50, `Rendering page ${pageIndices[0]}…`, { index: 1, total: pageIndices.length })
      const { name, data } = await processPage(pageIndices[0]!)
      checkAbort(ctx.signal)
      ctx.onProgress(100, 'Done')
      return writeOutput(ctx, name, data)
    }

    const entries: Array<{ name: string; data: Uint8Array | ArrayBuffer | Buffer }> = []
    const failed: Array<{ name: string; error: string }> = []
    for (let i = 0; i < pageIndices.length; i++) {
      checkAbort(ctx.signal)
      const pageNum = pageIndices[i]!
      ctx.onProgress(5 + (i / pageIndices.length) * 90, `Rendering page ${pageNum}…`, {
        index: i + 1,
        total: pageIndices.length,
      })
      try {
        const { name, data } = await processPage(pageNum)
        entries.push({ name, data })
      } catch (err) {
        if (ctx.signal.aborted) throw err
        failed.push({ name: `Page ${pageNum}`, error: err instanceof Error ? err.message : String(err) })
      }
    }
    if (failed.length > 0) {
      throw new BatchError(
        `${entries.length} of ${pageIndices.length} pages were rendered, but ${failed.length} could not be.`,
        { failedFiles: failed, details: failed.map((f) => `${f.name}: ${f.error}`).join('\n') },
      )
    }
    ctx.onProgress(96, 'Writing ZIP…')
    checkAbort(ctx.signal)
    const result = await writeZipArchive(ctx, entries, file.name, 'pages')
    ctx.onProgress(100, 'Done')
    return result
  } finally {
    await loadingTask.destroy().catch(() => {})
  }
}