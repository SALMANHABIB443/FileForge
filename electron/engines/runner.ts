import path from 'node:path'
import { createRequire } from 'node:module'
import fsp from 'node:fs/promises'
import { app } from 'electron'
import { jobTempDir } from '../services/temp'
import { imagesToPdf, mergePdfs, splitPdf, compressPdf, organizePdf } from './modules/pdf'
import { createZip, extractZip } from './modules/zip'
import { extractTar } from './modules/tar'
import { batchRename } from './modules/rename'
import { findDuplicates } from './modules/duplicate'
import { getFileInfo } from './modules/file-info'
import { runHeavy } from './pool'
import { checkAbort } from './util/common'
import type { EngineContext, EngineInputFile, EngineKind, EngineOptions, EngineProgressDetail, EngineResult } from './types'
import type { HeavyRequest } from './pool'

const HEAVY_KINDS: ReadonlySet<EngineKind> = new Set<EngineKind>([
  'image.convert',
  'image.compress',
  'image.resize',
  'image.crop',
  'pdf.toImages',
  'ffmpeg.extractAudio',
  'ffmpeg.convertAudio',
  'ffmpeg.compressVideo',
])

interface LightDispatchContext {
  workDir: string
  signal: AbortSignal
  onProgress: (percent: number, message?: string, detail?: EngineProgressDetail) => void
}

type LightDispatch = (
  inputs: EngineInputFile[],
  options: EngineOptions,
  ctx: LightDispatchContext,
) => Promise<EngineResult>

const LIGHT_DISPATCH: Record<Exclude<EngineKind, HeavyKind>, LightDispatch> = {
  'pdf.imagesToPdf': (files, options, ctx) => imagesToPdf(files, options, ctx),
  'pdf.merge': (files, options, ctx) => mergePdfs(files, options, ctx),
  'pdf.split': (files, options, ctx) => splitPdf(files, options, ctx),
  'pdf.compress': (files, options, ctx) => compressPdf(files, options, ctx),
  'pdf.organize': (files, options, ctx) => organizePdf(files, options, ctx),
  'zip.create': (files, options, ctx) => createZip(files, options, ctx),
  'zip.extract': (files, options, ctx) => extractZip(files, options, ctx),
  'tar.extract': (files, options, ctx) => extractTar(files, options, ctx),
  'rename.batch': (files, options, ctx) => batchRename(files, options, ctx),
  duplicates: (files, _options, ctx) =>
    findDuplicates(files, ctx).then((groups) => ({ kind: 'data', data: groups })),
  fileInfo: async (files, _options, ctx) => {
    const file = files[0]!
    const info = await getFileInfo(file, ctx as EngineContext)
    return { kind: 'data', data: info }
  },
  computeHash: async (files, options, ctx) => {
    const length = Number(options.length)
    const single = length > 0 ? [files[0]!] : files
    const hashes: Array<{ name: string; size: number; hash: string }> = []
    for (const file of single) {
      checkAbort(ctx.signal)
      const info = await getFileInfo(file, ctx as EngineContext)
      hashes.push({ name: file.name, size: file.size, hash: info.hash ?? '' })
    }
    return { kind: 'data', data: hashes }
  },
}

type HeavyKind = 'image.convert' | 'image.compress' | 'image.resize' | 'image.crop' | 'pdf.toImages' | 'ffmpeg.extractAudio' | 'ffmpeg.convertAudio' | 'ffmpeg.compressVideo'

export function isHeavyEngine(kind: string): boolean {
  return HEAVY_KINDS.has(kind as EngineKind)
}

export async function runEngine(
  requestId: string,
  kind: EngineKind,
  files: EngineInputFile[],
  options: EngineOptions,
  signal: AbortSignal,
  onProgress: (percent: number, message?: string, detail?: EngineProgressDetail) => void,
): Promise<EngineResult> {
  const workDir = jobTempDir(requestId)
  const requireFromMain = createRequire(import.meta.url)
  await fsp.mkdir(workDir, { recursive: true })

  if (isHeavyEngine(kind)) {
    const heavy: HeavyRequest = {
      requestId,
      kind,
      files,
      options,
      workDir,
      onProgress,
      signal,
      ffmpegPath: resolveFfmpegPath(requireFromMain),
    }
    return runHeavy(heavy)
  }

  const ctx: LightDispatchContext = {
    workDir,
    signal,
    onProgress,
  }
  const dispatch = LIGHT_DISPATCH[kind as Exclude<EngineKind, HeavyKind>]
  if (!dispatch) {
    throw new Error(`Unknown engine kind: ${kind}`)
  }
  try {
    const result = await dispatch(files, options, ctx)
    checkAbort(ctx.signal)
    return result
  } catch (err) {
    if (signal.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    throw err
  }
}

function resolveFfmpegPath(requireFromMain: NodeRequire): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
  }
  const binary = requireFromMain('ffmpeg-static')
  return typeof binary === 'string' ? binary : String(binary)
}

export type { EngineContext }