import { describe, it, expect, afterEach } from 'vitest'
import type { FileForgeApi } from '../../electron/types'
import {
  isDesktop,
  readFileAsBlob,
  readFileAsArrayBuffer,
  fileMetasFromDrop,
  writeExtractionEntry,
} from './file-service'
import type { FileMeta } from '@/types/job'

function installWindow(api: Partial<FileForgeApi>) {
  const original = (globalThis as Record<string, unknown>).window
  ;(globalThis as Record<string, unknown>).window = { fileforge: api }
  return () => {
    if (original === undefined) delete (globalThis as Record<string, unknown>).window
    else (globalThis as Record<string, unknown>).window = original
  }
}

describe('file-service (desktop branch)', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
  })

  it('detects the desktop environment through window.fileforge', () => {
    expect(isDesktop()).toBe(false)
    const restore = installWindow({})
    expect(isDesktop()).toBe(true)
    restore()
  })

  it('reads a path-based file through IPC as an ArrayBuffer', async () => {
    const bytes = new Uint8Array([72, 105])
    const restore = installWindow({ readFile: async () => bytes.buffer as ArrayBuffer })
    const meta: FileMeta = { id: '1', name: 'a.txt', size: 2, type: 'text/plain', lastModified: 1, path: 'C:/files/a.txt' }
    await expect(readFileAsArrayBuffer(meta)).resolves.toEqual(bytes.buffer)
    restore()
  })

  it('wraps IPC bytes in a Blob for blob consumers', async () => {
    const bytes = new Uint8Array([72, 105])
    const restore = installWindow({ readFile: async () => bytes.buffer as ArrayBuffer })
    const meta: FileMeta = { id: '1', name: 'a.txt', size: 2, type: 'text/plain', lastModified: 1, path: 'C:/files/a.txt' }
    const blob = await readFileAsBlob(meta)
    expect(blob.type).toBe('')
    expect(await blob.arrayBuffer()).toEqual(bytes.buffer)
    restore()
  })

  it('falls back to the File object when there is no desktop API', async () => {
    const file = new File(['hello'], 'b.txt')
    const meta: FileMeta = { id: '1', name: 'b.txt', size: 5, type: 'text/plain', lastModified: 1, file }
    const blob = await readFileAsBlob(meta)
    expect(await blob.text()).toBe('hello')
  })

  it('resolves dropped files to real paths on desktop', () => {
    const restore = installWindow({ getPathForFile: (f) => `C:/drop/${f.name}` })
    const dropped = [new File(['x'], 'd.txt')]
    const metas = fileMetasFromDrop(dropped)
    expect(metas[0]?.path).toBe('C:/drop/d.txt')
    expect(metas[0]?.name).toBe('d.txt')
    restore()
  })

  it('keeps File-object semantics for drops in the browser', () => {
    const dropped = [new File(['x'], 'e.txt')]
    const metas = fileMetasFromDrop(dropped)
    expect(metas[0]?.file).toBeInstanceOf(File)
    expect(metas[0]?.path).toBeUndefined()
  })

  it('forwards extraction entries to the desktop write API', async () => {
    let captured: { root: string; entryPath: string } | null = null
    const restore = installWindow({
      extractWrite: async (req) => {
        captured = { root: req.root, entryPath: req.entryPath }
        return 'C:/dest/a.txt'
      },
    })
    await writeExtractionEntry('C:/dest', 'sub/a.txt', new Uint8Array([1]))
    expect(captured).toEqual({ root: 'C:/dest', entryPath: 'sub/a.txt' })
    restore()
  })

  it('throws when extraction is requested outside the desktop app', async () => {
    await expect(writeExtractionEntry('C:/dest', 'a.txt', new Uint8Array([1]))).rejects.toThrow(
      'desktop app',
    )
  })
})