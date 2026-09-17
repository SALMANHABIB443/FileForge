export type PwaHooks = {
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  offlineReady: boolean
  needRefresh: boolean
  offlineReadyAndWebmanifestDownloaded: () => void
}

export function useRegisterSW(): PwaHooks {
  return {
    updateServiceWorker: async () => {},
    offlineReady: false,
    needRefresh: false,
    offlineReadyAndWebmanifestDownloaded: () => {},
  }
}