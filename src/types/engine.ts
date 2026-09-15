import type { FileMeta } from './job'

export interface ConversionResult {
  blob: Blob
  filename: string
}

export type ProgressCallback = (percent: number, message?: string) => void

export interface EngineAdapter {
  execute(
    inputs: FileMeta[],
    options: Record<string, unknown>,
    onProgress: ProgressCallback,
    signal: AbortSignal,
  ): Promise<ConversionResult>
}

export type EngineModule = {
  execute: EngineAdapter['execute']
}

export function lazyEngine(loader: () => Promise<EngineModule>): EngineAdapter {
  return {
    async execute(inputs, options, onProgress, signal) {
      const mod = await loader()
      return mod.execute(inputs, options, onProgress, signal)
    },
  }
}
