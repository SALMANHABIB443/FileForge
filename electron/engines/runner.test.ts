import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runEngine, isHeavyEngine } from './runner'
import { setTempBase } from '../services/temp'

const heavyMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({ app: { isPackaged: false } }))

vi.mock('./pool', () => ({ runHeavy: heavyMock }))

const engineResult = { kind: 'file', filename: 'out.jpg', outputPath: 'C:\\tmp\\out.jpg', outputSize: 123 }

describe('engine runner', () => {
  let temp: string
  let inputFile: string

  beforeEach(async () => {
    heavyMock.mockReset()
    heavyMock.mockResolvedValue(engineResult)
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-runner-'))
    setTempBase(temp)
    inputFile = path.join(temp, 'input', 'a.bin')
    await fs.mkdir(path.dirname(inputFile), { recursive: true })
    await fs.writeFile(inputFile, Buffer.alloc(1024, 3))
  })

  afterEach(async () => {
    await fs.rm(temp, { recursive: true, force: true })
  })

  const progress = vi.fn()
  const signal = new AbortController().signal

  it('classifies heavy and light kinds', () => {
    expect(isHeavyEngine('image.compress')).toBe(true)
    expect(isHeavyEngine('ffmpeg.extractAudio')).toBe(true)
    expect(isHeavyEngine('pdf.toImages')).toBe(true)
    expect(isHeavyEngine('pdf.merge')).toBe(false)
    expect(isHeavyEngine('rename.batch')).toBe(false)
    expect(isHeavyEngine('fileInfo')).toBe(false)
  })

  it('routes heavy kinds through the worker pool', async () => {
    const result = await runEngine('r-heavy', 'image.compress', [{ path: inputFile, name: 'a.bin', size: 1024 }], { quality: 80 }, signal, progress)
    expect(result).toEqual(engineResult)
    expect(heavyMock).toHaveBeenCalledTimes(1)
    const arg = heavyMock.mock.calls[0]![0]
    expect(arg.kind).toBe('image.compress')
    expect(arg.requestId).toBe('r-heavy')
    expect(arg.workDir).toBe(path.join(temp, 'jobs', 'r-heavy'))
  })

  it('runs light computeHash in the main process', async () => {
    const result = (await runEngine('r-light', 'computeHash', [{ path: inputFile, name: 'a.bin', size: 1024 }], {}, signal, progress)) as { kind: 'data'; data: unknown }
    expect(result.kind).toBe('data')
    expect(result.data).toBeDefined()
    expect(heavyMock).not.toHaveBeenCalled()
  })

  it('rejects unknown engine kinds', async () => {
    await expect(runEngine('r-unk', 'nope.kind' as never, [], {}, signal, progress)).rejects.toThrow(/unknown engine kind/i)
  })

  it('honors an already-aborted signal', async () => {
    const aborted = new AbortController()
    aborted.abort()
    await expect(runEngine('r-abort', 'computeHash', [{ path: inputFile, name: 'a.bin', size: 1024 }], {}, aborted.signal, progress)).rejects.toThrow(/cancelled/i)
  })

  it('passes the request signal to the heavy pool', async () => {
    const controller = new AbortController()
    const promise = runEngine('r-sig', 'image.compress', [{ path: inputFile, name: 'a.bin', size: 1024 }], {}, controller.signal, progress)
    await vi.waitFor(() => expect(heavyMock).toHaveBeenCalledTimes(1))
    expect(heavyMock.mock.calls[0]![0].signal).toBe(controller.signal)
    await promise
  })
})