import type { FileMeta, JobProgressDetail } from './job'

export interface ConversionResult {
  blob?: Blob
  filename: string
  outputPath?: string
  outputSize?: number
  data?: unknown
}

export type ProgressCallback = (
  percent: number,
  message?: string,
  detail?: JobProgressDetail,
) => void

export interface EngineContext {
  requestId?: string
}

export interface EngineAdapter {
  execute(
    inputs: FileMeta[],
    options: Record<string, unknown>,
    onProgress: ProgressCallback,
    signal: AbortSignal,
    context?: EngineContext,
  ): Promise<ConversionResult>
}

export type EngineModule = {
  execute: EngineAdapter['execute']
}

export function lazyEngine(loader: () => Promise<EngineModule>): EngineAdapter {
  return {
    async execute(inputs, options, onProgress, signal, context) {
      const mod = await loader()
      return mod.execute(inputs, options, onProgress, signal, context)
    },
  }
}
