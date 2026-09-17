import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IPC } from '../channels'
import { registerUpdateHandlers, resetUpdaterControllerForTests } from './updater'

const { handlers, sentLog, recordSend } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const sentLog: Array<{ channel: string; payload: unknown }> = []
  const recordSend = (channel: string, payload: unknown): void => {
    sentLog.push({ channel, payload })
  }
  return { handlers, sentLog, recordSend }
})

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { isDestroyed: () => false, send: recordSend } }],
  },
  ipcMain: {
    handle: (channel: string, fn: () => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

function statusTypes(): string[] {
  const seen: string[] = []
  for (const entry of sentLog) {
    const type = (entry.payload as { type: string }).type
    if (seen[seen.length - 1] !== type) seen.push(type)
  }
  return seen
}

function statusPayload(index = sentLog.length - 1): { type: string } {
  const entry = sentLog[index]
  if (!entry) throw new Error('expected a sent update status')
  return entry.payload as { type: string }
}

describe('update IPC handlers', () => {
  beforeEach(() => {
    resetUpdaterControllerForTests()
    sentLog.length = 0
    handlers.clear()
    process.env['FILEFORGE_UPDATER_MOCK'] = '1'
    delete process.env['FILEFORGE_UPDATER_MOCK_ERR']
    registerUpdateHandlers()
  })

  afterEach(() => {
    delete process.env['FILEFORGE_UPDATER_MOCK']
    delete process.env['FILEFORGE_UPDATER_MOCK_ERR']
  })

  it('registers the three update channels', () => {
    expect(handlers.has(IPC.UpdateCheck)).toBe(true)
    expect(handlers.has(IPC.UpdateDownload)).toBe(true)
    expect(handlers.has(IPC.UpdateInstall)).toBe(true)
  })

  it('streams checking → available → downloading → downloaded over update:status', async () => {
    const check = handlers.get(IPC.UpdateCheck)!
    const download = handlers.get(IPC.UpdateDownload)!
    await check(undefined)
    expect(statusTypes()).toEqual(['checking', 'available'])

    await download(undefined)
    expect(statusTypes()).toEqual(['checking', 'available', 'downloading', 'downloaded'])
  })

  it('emits a dev status in development mode without the mock flag', async () => {
    resetUpdaterControllerForTests()
    sentLog.length = 0
    delete process.env['FILEFORGE_UPDATER_MOCK']
    const check = handlers.get(IPC.UpdateCheck)!
    await check(undefined)
    expect(statusPayload()).toEqual({ type: 'dev' })
  })

  it('forwards error statuses when the mock check fails', async () => {
    resetUpdaterControllerForTests()
    sentLog.length = 0
    process.env['FILEFORGE_UPDATER_MOCK_ERR'] = 'check'
    const check = handlers.get(IPC.UpdateCheck)!
    await check(undefined)
    expect(statusPayload()).toMatchObject({ type: 'error' })
  })

  it('rejects handlers called with arguments', async () => {
    const check = handlers.get(IPC.UpdateCheck)!
    await expect(check(undefined, 'extra')).rejects.toThrow('does not accept arguments')
    const download = handlers.get(IPC.UpdateDownload)!
    await expect(download(undefined, { junk: true })).rejects.toThrow('does not accept arguments')
  })
})