import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { logger } from '@/services/logger'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALL_DISMISS_KEY = 'fileforge_install_dismissed'

export function PwaManager() {
  const [offlineReady, setOfflineReady] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const { updateServiceWorker } = useRegisterSW({
    onOfflineReady: () => setOfflineReady(true),
    onNeedRefresh: () => setNeedRefresh(true),
    onRegisterError: (error) => {
      logger.warn('Service worker registration failed', 'pwa', String(error))
    },
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setInstallEvent(null)
  }

  const dismissInstall = () => {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setInstallEvent(null)
    setInstallDismissed(true)
  }

  if (needRefresh) {
    return (
      <div className="fixed top-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div
          role="status"
          className="rounded-[var(--radius-cards)] border border-hairline bg-paper p-4 shadow-[var(--shadow-card)]"
        >
          <p className="text-[14px] font-medium text-ink">Update available</p>
          <p className="mt-1 text-[12px] text-mid-gray">A new version of FileForge is ready.</p>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-buttons)] bg-brown px-4 text-[13px] font-semibold text-paper"
            >
              Restart to update
          </button>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="fixed top-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div
          role="status"
          className="rounded-[var(--radius-cards)] border border-hairline bg-paper p-4 shadow-[var(--shadow-card)]"
        >
          <p className="text-[14px] font-medium text-ink">Ready to work offline</p>
          <p className="mt-1 text-[12px] text-mid-gray">FileForge is cached. You can use it without a connection.</p>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-buttons)] bg-surface-alt px-4 text-[13px] font-semibold text-brown-dark"
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  if (installEvent && !installDismissed) {
    return (
      <div className="fixed top-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div
          role="status"
          className="rounded-[var(--radius-cards)] border border-hairline bg-paper p-4 shadow-[var(--shadow-card)]"
        >
          <p className="text-[14px] font-medium text-ink">Install FileForge</p>
          <p className="mt-1 text-[12px] text-mid-gray">
            Add FileForge to your home screen or Start menu for quick, offline access.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-buttons)] bg-brown px-4 text-[13px] font-semibold text-paper"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-buttons)] bg-surface-alt px-4 text-[13px] font-semibold text-brown-dark"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}