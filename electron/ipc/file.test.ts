import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { IPC } from '../channels'
import { registerFileHandlers } from './file'
import { setTempBase } from '../services/temp'
import { approveReadPaths, clearApprovals } from '../services/approval'

const { handlers, dialogs } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const dialogs = {
    showOpenDialog: vi.fn(
      async (): Promise<{ canceled: boolean; filePaths: string[] }> => ({ canceled: true, filePaths: [] }),
    ),
    showSaveDialog: vi.fn(
      async (): Promise<{ canceled: boolean; filePath: string | null }> => ({ canceled: true, filePath: null }),
    ),
  }
  return { handlers, dialogs }
})

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: () => null,
  },
  dialog: dialogs,
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

const h = (channel: string) => handlers.get(channel)!

async function makeTemp(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-ipc-file-'))
  setTempBase(dir)
  return dir
}

describe('file IPC handlers', () => {
  let temp: string
  let fixture: string

  beforeEach(async () => {
    handlers.clear()
    dialogs.showOpenDialog.mockClear()
    dialogs.showSaveDialog.mockClear()
    clearApprovals()
    temp = await makeTemp()
    fixture = path.join(temp, 'a', 'sample.txt')
    await fs.mkdir(path.dirname(fixture), { recursive: true })
    await fs.writeFile(fixture, Buffer.from('hello fileforge'))
    registerFileHandlers()
  })

  afterEach(async () => {
    clearApprovals()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('registers all fourteen file channels', () => {
    expect(handlers.has(IPC.FileSelectFiles)).toBe(true)
    expect(handlers.has(IPC.FileSelectFolder)).toBe(true)
    expect(handlers.has(IPC.FileSaveAs)).toBe(true)
    expect(handlers.has(IPC.FileRead)).toBe(true)
    expect(handlers.has(IPC.FileWrite)).toBe(true)
    expect(handlers.has(IPC.FileExtractWrite)).toBe(true)
    expect(handlers.has(IPC.FileStat)).toBe(true)
    expect(handlers.has(IPC.FileApprovePaths)).toBe(true)
    expect(handlers.has(IPC.FileClearApprovals)).toBe(true)
    expect(handlers.has(IPC.FileGetTempDir)).toBe(true)
    expect(handlers.has(IPC.FileSaveOutput)).toBe(true)
    expect(handlers.size).toBeGreaterThanOrEqual(11)
  })

  it('statFile returns info for existing files and null for missing ones', async () => {
    const info = await h(IPC.FileStat)(undefined, fixture)
    expect(info).toMatchObject({ name: 'sample.txt', size: 15, isFile: true })
    const missing = await h(IPC.FileStat)(undefined, path.join(temp, 'nope.txt'))
    expect(missing).toBeNull()
    expect(await h(IPC.FileStat)(undefined, '')).toBeNull()
    expect(await h(IPC.FileStat)(undefined, 42)).toBeNull()
  })

  it('statFile rejects null-byte paths', async () => {
    await expect(h(IPC.FileStat)(undefined, `bad\0path`)).rejects.toThrow()
  })

  it('readFile rejects unapproved paths', async () => {
    await expect(h(IPC.FileRead)(undefined, fixture)).rejects.toThrow(/approved/i)
  })

  it('readFile returns bytes for approved paths', async () => {
    approveReadPaths([fixture])
    const buf = await h(IPC.FileRead)(undefined, fixture)
    expect(Buffer.from(buf as ArrayBuffer).toString()).toBe('hello fileforge')
  })

  it('readFile rejects traversal and null-byte paths', async () => {
    approveReadPaths([fixture])
    await expect(h(IPC.FileRead)(undefined, path.join(temp, '..', 'sys.txt'))).rejects.toThrow()
    await expect(h(IPC.FileRead)(undefined, 'bad\0')).rejects.toThrow()
  })

  it('writeFile writes inside the temp base and rejects outside', async () => {
    const target = path.join(temp, 'jobs', 'w1', 'out.txt')
    const resultPath = await h(IPC.FileWrite)(undefined, { path: target, data: new Uint8Array([1, 2, 3]) })
    expect(resultPath).toBe(path.resolve(target))
    expect(await fs.readFile(target)).toEqual(Buffer.from([1, 2, 3]))

    const outside = path.join(os.tmpdir(), 'ff-ipc-outside.txt')
    await expect(h(IPC.FileWrite)(undefined, { path: outside, data: new Uint8Array(1) })).rejects.toThrow(/allowed/i)
    await expect(h(IPC.FileWrite)(undefined, { data: new Uint8Array(1) })).rejects.toThrow()
  })

  it('extractWrite sanitizes entry paths and creates parent dirs', async () => {
    const root = path.join(temp, 'extract')
    const target = await h(IPC.FileExtractWrite)(undefined, {
      root,
      entryPath: 'nested/dir/file.txt',
      data: new Uint8Array([9]),
    })
    expect(target).toBe(path.join(root, 'nested', 'dir', 'file.txt'))
    expect(await fs.readFile(path.join(root, 'nested', 'dir', 'file.txt'))).toEqual(Buffer.from([9]))
  })

  it('extractWrite rejects traversal and absolute entry paths', async () => {
    const root = path.join(temp, 'extract2')
    await expect(h(IPC.FileExtractWrite)(undefined, { root, entryPath: '../evil.txt', data: new Uint8Array(1) })).rejects.toThrow()
    await expect(h(IPC.FileExtractWrite)(undefined, { root, entryPath: 'C:\\evil.txt', data: new Uint8Array(1) })).rejects.toThrow()
  })

  it('selectFiles returns approved infos from the open dialog', async () => {
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [fixture] })
    const picked = (await h(IPC.FileSelectFiles)({ sender: {} })) as Array<{ name: string; size: number }>
    expect(picked).toHaveLength(1)
    expect(picked[0]).toMatchObject({ name: 'sample.txt', size: 15 })
    expect(await h(IPC.FileRead)(undefined, fixture)).toBeDefined()
  })

  it('selectFiles returns an empty array when the dialog is cancelled', async () => {
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await h(IPC.FileSelectFiles)({ sender: {} })).toEqual([])
  })

  it('selectFolder registers the chosen directory as a write root', async () => {
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [temp] })
    const folder = await h(IPC.FileSelectFolder)({ sender: {} })
    expect(folder).toEqual({ path: path.resolve(temp), name: path.basename(temp) })
    const target = path.join(temp, 'folder-write', 'x.txt')
    await expect(h(IPC.FileWrite)(undefined, { path: target, data: new Uint8Array(1) })).resolves.toBe(path.resolve(target))
  })

  it('saveOutput writes beside the approved input, auto-renaming on collision', async () => {
    approveReadPaths([fixture])
    const first = (await h(IPC.FileSaveOutput)({ sender: {} }, {
      data: new Uint8Array([7]),
      suggestedName: 'out.pdf',
    })) as { path: string; location: string }
    expect(first).toMatchObject({ path: path.join(temp, 'a', 'out.pdf'), location: 'inputFolder' })
    const second = (await h(IPC.FileSaveOutput)({ sender: {} }, {
      data: new Uint8Array([8]),
      suggestedName: 'out.pdf',
    })) as { path: string; location: string }
    expect(second.path).toBe(path.join(temp, 'a', 'out (1).pdf'))
    expect(await fs.readFile(first.path)).toEqual(Buffer.from([7]))
    expect(await fs.readFile(second.path)).toEqual(Buffer.from([8]))
  })

  it('saveOutput falls back to the temp base when no inputs are approved', async () => {
    const result = (await h(IPC.FileSaveOutput)({ sender: {} }, {
      data: new Uint8Array([1]),
      suggestedName: 'fallback.bin',
    })) as { path: string; location: string }
    expect(result.location).toBe('temp')
    expect(await fs.readFile(result.path)).toEqual(Buffer.from([1]))
  })

  it('saveAs returns null when the dialog is cancelled and writes when confirmed', async () => {
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: null })
    expect(await h(IPC.FileSaveAs)({ sender: {} }, { data: new Uint8Array([1]), suggestedName: 'a.txt' })).toBeNull()

    const pick = path.join(temp, 'pick', 'out.txt')
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: pick })
    const saved = await h(IPC.FileSaveAs)({ sender: {} }, { data: new Uint8Array([2, 3]), suggestedName: 'out.txt' }) as string | null
    expect(saved).toBe(path.resolve(pick))
    expect(await fs.readFile(pick)).toEqual(Buffer.from([2, 3]))
  })

  it('saveAs validates the request object', async () => {
    await expect(h(IPC.FileSaveAs)({ sender: {} }, null)).rejects.toThrow()
  })
})