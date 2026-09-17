import { getAllJobs, subscribeToAllJobs } from '@/services/job-service'
import { loadSettings } from '@/services/settings-service'
import { subscribeUpdates } from '@/services/updater'
import { isDesktop } from '@/services/file-service'
import type { Job } from '@/types/job'

const NOTIFY_TITLE = 'FileForge'

/**
 * Builds the toast body for a terminal job. Notification text is deliberately
 * generic — no filenames or paths are ever included (privacy requirement).
 */
export function notificationBody(job: Job): string {
  const total = job.progress.total
  if (job.status === 'completed') {
    if (total !== undefined && total > 1) {
      return `Batch complete — ${total} files processed.`
    }
    return 'Done — your files are ready.'
  }
  return 'Something went wrong while processing. Open FileForge for details.'
}

export interface NotificationSender {
  isDesktop: () => boolean
  isFocused: () => boolean
  isEnabled: () => boolean
  send: (title: string, body: string) => Promise<boolean>
}

const defaultSender: NotificationSender = {
  isDesktop,
  isFocused: () => typeof document !== 'undefined' && document.hasFocus(),
  isEnabled: () => loadSettings().notificationsEnabled,
  send: async (title, body) => {
    try {
      const result = await window.fileforge!.notify({ title, body })
      return result.ok
    } catch {
      return false
    }
  },
}

/**
 * Subscribes to the global job store and raises a Windows toast when a job
 * finishes or fails, but only while FileForge is running in the background and
 * notifications are enabled in Settings. Returns an unsubscribe function.
 */
export function initDesktopNotifications(sender: NotificationSender = defaultSender): () => void {
  if (!sender.isDesktop()) return () => {}

  const notifiedIds = new Set<string>()

  const handle = (job: Job): void => {
    if (job.status !== 'completed' && job.status !== 'failed') return
    if (notifiedIds.has(job.id)) return
    if (sender.isFocused() || !sender.isEnabled()) return
    void sender.send(NOTIFY_TITLE, notificationBody(job)).then((ok) => {
      if (ok) notifiedIds.add(job.id)
    })
  }

  for (const job of getAllJobs()) handle(job)
  return subscribeToAllJobs(handle)
}

/**
 * Raises a Windows toast when a new FileForge version is available, but only
 * while the window is in the background and notifications are enabled. The
 * body is deliberately generic — no version details are ever included.
 */
export function initUpdateNotifications(sender: NotificationSender = defaultSender): () => void {
  if (!sender.isDesktop()) return () => {}

  let toastedVersion: string | null = null

  return subscribeUpdates((updates) => {
    if (updates.type !== 'available') return
    if (updates.version === toastedVersion) return
    if (sender.isFocused() || !sender.isEnabled()) return
    toastedVersion = updates.version
    void sender.send('Update available', 'A new version of FileForge is available.')
  })
}