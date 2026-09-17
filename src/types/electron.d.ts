import type { FileForgeApi } from '../../electron/types'

declare global {
  interface Window {
    fileforge?: FileForgeApi
  }
}

export {}