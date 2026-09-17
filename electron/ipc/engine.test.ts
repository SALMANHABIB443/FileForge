import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { IPC } from '../channels'
import { registerEngineHandlers } from './engine'
import { setTempBase, jobTempDir } from '../services/temp'
import { approveReadPaths, clearApprovals } from '../services/approval'

const { handlers, dialogs, sentLog } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const sentLog: Array<{ channel: string; payload: unknown }> = []
  const dialogs = {
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: null as string | null })),
  }
  return { handlers, sentLog, dialogs }
})

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: { fromWebContents: () => null },
  dialog: dialogs,
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

const h = (channel: string) => handlers.get(channel)!

function mockEvent() {
  return { sender: { isDestroyed: () => false, send: (channel: string, payload: unknown) => sentLog.push({ channel, payload }) } }
}

describe('engine IPC handlers', () => {
  let temp: string
  let tempBase: string
  let inputFile: string

  beforeEach(async () => {
    handlers.clear()
    sentLog.length = 0
    dialogs.showSaveDialog.mockClear()
    clearApprovals()
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-ipc-engine-'))
    tempBase = path.join(temp, 'tb')
    setTempBase(tempBase)
    const inputDir = path.join(temp, 'input')
    inputFile = path.join(inputDir, 'sample.bin')
    await fs.mkdir(inputDir, { recursive: true })
    await fs.writeFile(inputFile, Buffer.alloc(4096, 7))
    approveReadPaths([inputFile])
    registerEngineHandlers()
  })

  afterEach(async () => {
    clearApprovals()
    await fs.rm(temp, { recursive: true, force: true })
  })

  const runReq = (overrides: Record<string, unknown> = {}) => ({
    requestId: 'req-1',
    kind: 'computeHash',
    files: [{ path: inputFile, name: 'sample.bin', size: 4096 }],
    options: {},
    ...overrides,
  })

  it('registers the engine and save channels', () => {
    expect(handlers.has(IPC.EngineRun)).toBe(true)
    expect(handlers.has(IPC.EngineCancel)).toBe(true)
    expect(handlers.has(IPC.FileSaveOutputFile)).toBe(true)
    expect(handlers.has(IPC.FileSaveAsFile)).toBe(true)
    expect(handlers.has(IPC.FileCleanupJobTemp)).toBe(true)
  })

  it('runs a light engine and returns data', async () => {
    const result = (await h(IPC.EngineRun)(mockEvent(), runReq())) as { kind: 'data'; data: unknown }
    expect(result.kind).toBe('data')
    expect(result.data).toBeDefined()
  })

  it('rejects duplicate request ids while a request is running', async () => {
    const first = h(IPC.EngineRun)(mockEvent(), runReq({ requestId: 'dup' }))
    await expect(h(IPC.EngineRun)(mockEvent(), runReq({ requestId: 'dup' }))).rejects.toThrow(/already running/i)
    await expect(first).resolves.toBeDefined()
  })

  it('allows reusing a request id after it finishes', async () => {
    await h(IPC.EngineRun)(mockEvent(), runReq({ requestId: 'again' }))
    await expect(h(IPC.EngineRun)(mockEvent(), runReq({ requestId: 'again' }))).resolves.toBeDefined()
  })

  it('validates the request shape and input files', async () => {
    const run = h(IPC.EngineRun)
    await expect(run(mockEvent(), null)).rejects.toThrow('request')
    await expect(run(mockEvent(), { kind: 'computeHash' })).rejects.toThrow('requestId')
    await expect(run(mockEvent(), { requestId: 'x', files: [] })).rejects.toThrow('kind')
    await expect(run(mockEvent(), runReq({ files: 'nope' }))).rejects.toThrow('array')
    await expect(run(mockEvent(), runReq({ files: [{ name: 'x' }] }))).rejects.toThrow('path')
    await expect(run(mockEvent(), runReq({ files: [{ path: '' }] }))).rejects.toThrow('path')
    await expect(run(mockEvent(), runReq({ files: [{ path: 'bad\0path' }] }))).rejects.toThrow()
  })

  it('rejects duplicate and unapproved input file paths', async () => {
    const run = h(IPC.EngineRun)
    await expect(run(mockEvent(), runReq({ files: [runReq().files[0], runReq().files[0]] }))).rejects.toThrow(/duplicate/i)
    clearApprovals()
    await expect(run(mockEvent(), runReq())).rejects.toThrow(/approved/i)
  })

  it('cancelEngine is a no-op for unknown request ids', () => {
    expect(h(IPC.EngineCancel)(undefined, 'unknown-id')).toBeUndefined()
    expect(() => h(IPC.EngineCancel)(undefined, '')).toThrow('requestId')
  })

  it('saveOutputFile copies a temp source beside the approved input', async () => {
    const src = jobTempDir('req-copy')
    await fs.mkdir(src, { recursive: true })
    await fs.writeFile(path.join(src, 'result.txt'), Buffer.from('ok'))
    const saved = (await h(IPC.FileSaveOutputFile)(mockEvent(), {
      sourcePath: path.join(src, 'result.txt'),
      suggestedName: 'result.txt',
    })) as { path: string; location: string }
    expect(saved.location).toBe('inputFolder')
    expect(await fs.readFile(saved.path)).toEqual(Buffer.from('ok'))
  })

  it('saveOutputFile rejects sources outside the temp dir', async () => {
    await fs.writeFile(path.join(temp, 'outside.txt'), Buffer.from('x'))
    await expect(
      h(IPC.FileSaveOutputFile)(mockEvent(), { sourcePath: path.join(temp, 'outside.txt'), suggestedName: 'outside.txt' }),
    ).rejects.toThrow(/temp/i)
  })

  it('saveOutputFile rejects output directories that were never approved', async () => {
    const src = jobTempDir('req-unauth')
    await fs.mkdir(src, { recursive: true })
    await fs.writeFile(path.join(src, 'result.txt'), Buffer.from('ok'))
    const unauth = path.join(os.tmpdir(), 'ff-unauth-output')
    await expect(
      h(IPC.FileSaveOutputFile)(mockEvent(), {
        sourcePath: path.join(src, 'result.txt'),
        suggestedName: 'result.txt',
        outputDir: unauth,
      }),
    ).rejects.toThrow(/approved/i)
  })

  it('saveAsFile copies the temp source to the chosen dialog path', async () => {
    const src = jobTempDir('req-saveas')
    await fs.mkdir(src, { recursive: true })
    const source = path.join(src, 'saved.txt')
    await fs.writeFile(source, Buffer.from('abc'))
    const target = path.join(temp, 'chosen', 'saved.txt')
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target })
    const result = await h(IPC.FileSaveAsFile)(mockEvent(), { sourcePath: source, suggestedName: 'saved.txt' })
    expect(result).toBe(path.resolve(target))
    expect(await fs.readFile(target)).toEqual(Buffer.from('abc'))
  })

  it('saveAsFile returns null when the dialog is cancelled', async () => {
    const src = jobTempDir('req-saveas-cancel')
    await fs.mkdir(src, { recursive: true })
    const source = path.join(src, 'saved.txt')
    await fs.writeFile(source, Buffer.from('abc'))
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: null })
    expect(await h(IPC.FileSaveAsFile)(mockEvent(), { sourcePath: source, suggestedName: 'saved.txt' })).toBeNull()
  })

  it('saveAsFile rejects sources outside the temp dir', async () => {
    const outside = path.join(temp, 'outside-as.txt')
    await fs.mkdir(path.dirname(outside), { recursive: true })
    await fs.writeFile(outside, Buffer.from('x'))
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: null })
    await expect(h(IPC.FileSaveAsFile)(mockEvent(), { sourcePath: outside, suggestedName: 'x.txt' })).rejects.toThrow(/temp/i)
  })

  it('cleanupJobTemp removes the job folder', async () => {
    const src = jobTempDir('req-clean')
    await fs.mkdir(src, { recursive: true })
    await fs.writeFile(path.join(src, 'x.txt'), Buffer.from('1'))
    await h(IPC.FileCleanupJobTemp)(undefined, 'req-clean')
    await expect(fs.access(src)).rejects.toThrow()
  })
})