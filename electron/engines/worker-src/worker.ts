import { parentPort } from 'node:worker_threads'
import type { WorkerRequest, WorkerStartRequest } from './protocol'
import type { EngineContext, EngineResult } from '../types'

const jobs = new Map<
  string,
  {
    signal: AbortSignal
    abort: () => void
    workDir: string
    ffmpegPath?: string
  }
>()

function post(message: unknown): void {
  if (parentPort) {
    parentPort.postMessage(message)
  }
}

function progress(
  requestId: string,
  percent: number,
  message?: string,
  detail?: { index?: number; total?: number },
): void {
  post({ type: 'progress', requestId, percent, message, detail })
}

async function dispatch(req: WorkerStartRequest): Promise<EngineResult> {
  const job = jobs.get(req.requestId)!
  const ctx: EngineContext = {
    workDir: job.workDir,
    signal: job.signal,
    onProgress: (p, m, d) => progress(req.requestId, p, m, d),
  }

  switch (req.kind) {
    case 'image.convert': {
      const { convertImage } = await import('../modules/image')
      return convertImage(ctx, req.files, req.options)
    }
    case 'image.compress': {
      const { compressImage } = await import('../modules/image')
      return compressImage(ctx, req.files, req.options)
    }
    case 'image.resize': {
      const { resizeImage } = await import('../modules/image')
      return resizeImage(ctx, req.files, req.options)
    }
    case 'image.crop': {
      const { cropImage } = await import('../modules/image')
      return cropImage(ctx, req.files, req.options)
    }
    case 'pdf.toImages': {
      const { pdfToImages } = await import('../modules/pdf-to-images')
      return pdfToImages(ctx, req.files, req.options)
    }
    case 'ffmpeg.extractAudio':
    case 'ffmpeg.convertAudio':
    case 'ffmpeg.compressVideo': {
      if (!req.ffmpegPath) {
        throw new Error('FFmpeg binary is not configured')
      }
      const ffmpeg = await import('../modules/ffmpeg')
      if (req.kind === 'ffmpeg.extractAudio') {
        return ffmpeg.extractAudio(ctx, req.files, req.options, req.ffmpegPath)
      }
      if (req.kind === 'ffmpeg.convertAudio') {
        return ffmpeg.convertAudio(ctx, req.files, req.options, req.ffmpegPath)
      }
      return ffmpeg.compressVideo(ctx, req.files, req.options, req.ffmpegPath)
    }
    default:
      throw new Error(`Unknown heavy engine: ${String(req.kind)}`)
  }
}

if (parentPort) {
  parentPort.on('message', (raw: unknown) => {
    const req = raw as WorkerRequest
    if (!req || typeof req !== 'object' || typeof (req as { requestId?: unknown }).requestId !== 'string') {
      return
    }

    if (req.type === 'abort') {
      const job = jobs.get(req.requestId)
      if (job) {
        job.abort()
      }
      return
    }

    if (req.type !== 'run') return

    const start = req as WorkerStartRequest
    const controller = new AbortController()
    jobs.set(start.requestId, {
      signal: controller.signal,
      abort: () => controller.abort(),
      workDir: start.workDir,
      ffmpegPath: start.ffmpegPath,
    })

    ;(async () => {
      try {
        const result = await dispatch(start)
        if (controller.signal.aborted) {
          post({ type: 'error', requestId: start.requestId, message: 'Operation cancelled' })
          return
        }
        post({ type: 'result', requestId: start.requestId, result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        post({ type: 'error', requestId: start.requestId, message })
      } finally {
        jobs.delete(start.requestId)
      }
    })()
  })
}

export {};