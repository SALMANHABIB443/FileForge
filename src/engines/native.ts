import type { ConversionResult, EngineAdapter, EngineModule } from '@/types/engine'
import { lazyEngine } from '@/types/engine'
import type { FileMeta } from '@/types/job'
import { isDesktop } from '@/services/file-service'
import type { EngineInputFile, EngineKind } from '../../electron/types'

let requestCounter = 0

function makeRequestId(): string {
  requestCounter++
  return `req_${Date.now().toString(36)}_${requestCounter}`
}

function requireOnDisk(inputs: FileMeta[]): void {
  for (const f of inputs) {
    if (!f.path) {
      throw new Error('The file is not available on disk — re-select it in the desktop app')
    }
  }
}

/**
 * Engine adapter that runs the given engine kind in the Electron main process
 * through `engine:run` IPC instead of executing in the renderer. Progress events
 * are pushed back via `onEngineProgress` and aborts cancel the remote request.
 */
export function nativeEngine(kind: EngineKind): EngineAdapter {
  return {
    async execute(inputs, options, onProgress, signal, context) {
      requireOnDisk(inputs)
      const api = window.fileforge!
      const requestId = context?.requestId ?? makeRequestId()

      const dispose = api.onEngineProgress((event) => {
        if (event.requestId === requestId) {
          onProgress(event.percent, event.message, event.detail)
        }
      })

      const abortRemote = () => {
        void api.cancelEngine(requestId)
      }
      if (signal.aborted) {
        abortRemote()
      } else {
        signal.addEventListener('abort', abortRemote, { once: true })
      }

      try {
        const files: EngineInputFile[] = inputs.map((f) => ({
          path: f.path!,
          name: f.name,
          size: f.size,
          lastModified: f.lastModified,
        }))
        const result = await api.runEngine({ requestId, kind, files, options })
        if (result.kind === 'data') {
          return { filename: '', data: result.data }
        }
        const out: ConversionResult = {
          filename: result.filename,
          outputPath: result.outputPath,
          outputSize: result.outputSize,
        }
        return out
      } finally {
        dispose()
        signal.removeEventListener('abort', abortRemote)
      }
    },
  }
}

/**
 * Picks the native (desktop) engine for `kind` when running in the Electron
 * app, otherwise falls back to the provided browser engine loader.
 */
export function engineFor(
  kind: EngineKind,
  webLoader: () => Promise<EngineModule>,
): EngineAdapter {
  if (isDesktop()) {
    return nativeEngine(kind)
  }
  return lazyEngine(webLoader)
}