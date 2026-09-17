import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { IPC } from '../channels'
import { registerShellHandlers } from './shell'

const { handlers, shellMocks } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const shellMocks = {
    openPath: vi.fn(async () => ''),
    showItemInFolder: vi.fn(),
  }
  return { handlers, shellMocks }
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
  shell: shellMocks,
}))

const h = (channel: string) => handlers.get(channel)!

describe('shell IPC handlers', () => {
  let temp: string
  let file: string

  beforeEach(async () => {
    handlers.clear()
    shellMocks.openPath.mockClear()
    shellMocks.showItemInFolder.mockClear()
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-ipc-shell-'))
    file = path.join(temp, 'exists.txt')
    await fs.writeFile(file, 'x')
    registerShellHandlers()
  })

  afterEach(async () => {
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('registers both shell channels', () => {
    expect(handlers.has(IPC.ShellOpenPath)).toBe(true)
    expect(handlers.has(IPC.ShellShowItemInFolder)).toBe(true)
  })

  it('openPath opens an existing file', async () => {
    shellMocks.openPath.mockResolvedValueOnce('')
    const result = (await h(IPC.ShellOpenPath)(undefined, file)) as { ok: boolean; error?: string }
    expect(result.ok).toBe(true)
    expect(shellMocks.openPath).toHaveBeenCalledWith(path.resolve(file))
  })

  it('openPath reports failure when the OS returns an error', async () => {
    shellMocks.openPath.mockResolvedValueOnce('There was an error')
    const result = (await h(IPC.ShellOpenPath)(undefined, file)) as { ok: boolean; error?: string }
    expect(result.ok).toBe(false)
    expect(result.error).toBe('There was an error')
  })

  it('openPath rejects missing files and bad arguments', async () => {
    const missing = await h(IPC.ShellOpenPath)(undefined, path.join(temp, 'nope.txt'))
    expect(missing).toMatchObject({ ok: false })
    await expect(h(IPC.ShellOpenPath)(undefined, '')).rejects.toThrow(/non-empty/)
    await expect(h(IPC.ShellOpenPath)(undefined, 'a\0b')).rejects.toThrow()
    await expect(h(IPC.ShellOpenPath)(undefined, 42)).rejects.toThrow(/non-empty/)
  })

  it('showItemInFolder reveals an existing file', () => {
    const result = h(IPC.ShellShowItemInFolder)(undefined, file) as { ok: boolean }
    expect(result.ok).toBe(true)
    expect(shellMocks.showItemInFolder).toHaveBeenCalledWith(path.resolve(file))
  })

  it('showItemInFolder validates its argument', () => {
    expect(() => h(IPC.ShellShowItemInFolder)(undefined, '')).toThrow(/non-empty/)
    expect(() => h(IPC.ShellShowItemInFolder)(undefined, 'b\0ad')).toThrow()
  })
})