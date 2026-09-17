import { vi } from 'vitest'
import type { FileForgeApi } from '../../electron/types'
import type { FileMeta, Job } from '@/types/job'

let counter = 0

export function makeFileMeta(overrides: Partial<FileMeta> = {}): FileMeta {
  counter += 1
  return {
    id: `file_${counter}`,
    name: 'sample.jpg',
    size: 1024,
    type: 'image/jpeg',
    lastModified: Date.now(),
    ...overrides,
  }
}

export function makeFile(name = 'sample.txt', size = 256, type = 'text/plain'): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: Date.now() })
}

export function makeJob(overrides: Partial<Job> = {}): Job {
  counter += 1
  return {
    id: `job_${counter}`,
    toolId: 'image-convert',
    status: 'completed',
    inputs: [makeFileMeta()],
    options: {},
    progress: { percent: 100 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function voidAsync(): Promise<void> {
  return Promise.resolve()
}

/**
 * Installs a full `window.fileforge` mock (default no-op / canned responses).
 * Returns the mock API so individual tests can override specific methods with
 * `vi.spyOn`/`mockImplementation`. Also deletes it cleanly if `fresh` is false.
 */
export function mockFileForge(overrides: Partial<FileForgeApi> = {}): FileForgeApi {
  const api: FileForgeApi = {
    invoke: vi.fn(async () => undefined) as FileForgeApi['invoke'],
    on: vi.fn(() => {}) as unknown as FileForgeApi['on'],
    getVersion: vi.fn(async () => '0.1.0-test'),
    getPlatform: vi.fn(async () => 'win32'),
    minimize: vi.fn(voidAsync),
    maximize: vi.fn(async () => true),
    close: vi.fn(voidAsync),
    isMaximized: vi.fn(async () => false),
    onMaximizeChange: vi.fn(() => () => {}) as unknown as FileForgeApi['onMaximizeChange'],
    selectFiles: vi.fn(async () => []),
    selectFolder: vi.fn(async () => null),
    saveAsOutput: vi.fn(async () => null),
    readFile: vi.fn(async () => new ArrayBuffer(0)),
    writeFile: vi.fn(async () => ''),
    extractWrite: vi.fn(async () => ''),
    statFile: vi.fn(async () => null),
    approvePaths: vi.fn(async () => 0),
    clearApprovals: vi.fn(voidAsync),
    getTempDir: vi.fn(async () => 'C:\\temp'),
    saveOutput: vi.fn(async () => null),
    saveOutputFile: vi.fn(async () => null),
    saveAsFile: vi.fn(async () => null),
    cleanupJobTemp: vi.fn(voidAsync),
    openFile: vi.fn(async () => ({ ok: true })),
    showItemInFolder: vi.fn(async () => ({ ok: true })),
    notify: vi.fn(async () => ({ ok: true, supported: true })),
    checkForUpdates: vi.fn(voidAsync),
    downloadUpdate: vi.fn(voidAsync),
    installAndRestart: vi.fn(voidAsync),
    onUpdateStatus: vi.fn(() => () => {}) as unknown as FileForgeApi['onUpdateStatus'],
    runEngine: vi.fn(),
    cancelEngine: vi.fn(voidAsync),
    onEngineProgress: vi.fn(() => () => {}) as unknown as FileForgeApi['onEngineProgress'],
    getPathForFile: vi.fn(() => 'C:\\tmp\\dropped.txt'),
    ...overrides,
  }
  Reflect.set(window, 'fileforge', api)
  return api
}

export function clearFileForge(): void {
  Reflect.deleteProperty(window, 'fileforge')
}