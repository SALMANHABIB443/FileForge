import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initDesktopNotifications,
  initUpdateNotifications,
  notificationBody,
  type NotificationSender,
} from '@/services/desktop-notifications'
import { initUpdater, resetUpdaterForTests } from '@/services/updater'
import type { UpdateStatus } from '../../electron/types'
import {
  createJob,
  updateJobStatus,
  updateJobProgress,
  failJob,
  deleteJob,
  getAllJobs,
} from '@/services/job-service'
import type { FileMeta } from '@/types/job'

function clearAllJobs(): void {
  for (const job of getAllJobs()) deleteJob(job.id)
}

function makeFileMeta(name = 'a.jpg'): FileMeta {
  return {
    id: `meta_${name}_${Math.random()}`,
    name,
    size: 100,
    type: 'image/jpeg',
    lastModified: 0,
  }
}

function makeSender(overrides: Partial<NotificationSender> = {}): {
  sender: NotificationSender
  send: ReturnType<typeof vi.fn>
} {
  const send = vi.fn(async (): Promise<boolean> => true)
  const sender: NotificationSender = {
    isDesktop: () => true,
    isFocused: () => false,
    isEnabled: () => true,
    send,
    ...overrides,
  }
  return { sender, send }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('desktop notifications', () => {
  beforeEach(() => {
    clearAllJobs()
  })

  it('uses generic completed text for a single-file job', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    const completed = updateJobStatus(job.id, 'completed')
    expect(notificationBody(completed)).toBe('Done — your files are ready.')
  })

  it('mentions the file count for batch jobs', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta(), makeFileMeta()] })
    updateJobProgress(job.id, 50, '', 1, 5)
    const completed = updateJobStatus(job.id, 'completed')
    expect(notificationBody(completed)).toBe('Batch complete — 5 files processed.')
  })

  it('uses failure text for failed jobs', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    const failed = failJob(job.id, 'boom')
    expect(notificationBody(failed)).toContain('Something went wrong')
  })

  it('uses the failure text for any non-completed terminal state', () => {
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    expect(notificationBody(job)).toContain('Something went wrong')
  })

  it('does nothing when the sender is not the desktop app', async () => {
    const { sender, send } = makeSender({ isDesktop: () => false })
    initDesktopNotifications(sender)
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'completed')
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('skips notifications while the window is focused', async () => {
    const { sender, send } = makeSender()
    sender.isFocused = () => true
    initDesktopNotifications(sender)
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'completed')
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('skips notifications when disabled in settings', async () => {
    const { sender, send } = makeSender()
    sender.isEnabled = () => false
    initDesktopNotifications(sender)
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'completed')
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('notifies once per finished job', async () => {
    const { sender, send } = makeSender()
    const unsubscribe = initDesktopNotifications(sender)
    const job = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(job.id, 'completed')
    await flush()
    updateJobProgress(job.id, 100, 'still done', 1, 1)
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toBe('FileForge')
    expect(send.mock.calls[0]![1]).toBe('Done — your files are ready.')
    unsubscribe()
  })

  it('notifies failed jobs too', async () => {
    const { sender, send } = makeSender()
    initDesktopNotifications(sender)
    const job = createJob({ toolId: 'pdf-merge', inputs: [makeFileMeta()] })
    failJob(job.id, 'boom')
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![1]).toContain('Something went wrong')
  })

  it('re-checks focus and settings for every job', async () => {
    const { sender, send } = makeSender()
    initDesktopNotifications(sender)
    const first = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(first.id, 'completed')
    await flush()
    expect(send).toHaveBeenCalledTimes(1)

    // Window is now not focused again and settings re-enabled: the next job notifies.
    const second = createJob({ toolId: 'image-convert', inputs: [makeFileMeta()] })
    updateJobStatus(second.id, 'completed')
    await flush()
    expect(send).toHaveBeenCalledTimes(2)
  })
})

describe('update-available notifications', () => {
  let emitUpdate: ((status: UpdateStatus) => void) | null = null

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => JSON.stringify({ autoCheckUpdates: false }),
        setItem: () => {},
        removeItem: () => {},
      },
      configurable: true,
    })
    ;(globalThis as unknown as { window: unknown }).window = {
      fileforge: {
        onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
          emitUpdate = callback
          return () => {
            emitUpdate = null
          }
        },
      },
    }
    initUpdater()
  })

  afterEach(() => {
    emitUpdate = null
    resetUpdaterForTests()
  })

  function announceUpdate(version = '9.9.9'): void {
    emitUpdate?.({ type: 'available', version })
  }

  it('sends a toast when an update becomes available', async () => {
    const { sender, send } = makeSender()
    initUpdateNotifications(sender)
    announceUpdate()
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toBe('Update available')
    expect(send.mock.calls[0]![1]).toBe('A new version of FileForge is available.')
  })

  it('sends only one toast per announced version', async () => {
    const { sender, send } = makeSender()
    initUpdateNotifications(sender)
    announceUpdate('1.0.0')
    announceUpdate('1.0.0')
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('skips the toast while the window is focused', async () => {
    const { sender, send } = makeSender()
    sender.isFocused = () => true
    initUpdateNotifications(sender)
    announceUpdate()
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('skips the toast when notifications are disabled', async () => {
    const { sender, send } = makeSender()
    sender.isEnabled = () => false
    initUpdateNotifications(sender)
    announceUpdate()
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('is a no-op outside the desktop app', async () => {
    const { sender, send } = makeSender({ isDesktop: () => false })
    initUpdateNotifications(sender)
    announceUpdate()
    await flush()
    expect(send).not.toHaveBeenCalled()
  })
})