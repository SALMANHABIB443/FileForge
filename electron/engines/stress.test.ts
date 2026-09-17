import fsp from 'node:fs/promises'
import { createCanvas } from '@napi-rs/canvas'
import JSZip from 'jszip'
import { describe, it, expect } from 'vitest'
import { convertImage, resizeImage } from './modules/image'
import { createZip, extractZip } from './modules/zip'
import { makeHarness, writeFixture, asFile } from './test-util'

const MB = 1024 * 1024

/**
 * Phase 14 stress coverage: moderately large fixtures, memory deltas and
 * mid-flight cancellation. Fixture sizes are kept small enough for CI but big
 * enough that a regression (e.g. loading a whole file twice, leaking buffers)
 * would show up in the delta assertions.
 */
function noisePng(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256)
    data[i + 1] = Math.floor(Math.random() * 256)
    data[i + 2] = Math.floor(Math.random() * 256)
    data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toBuffer('image/png')
}

function randomBytes(size: number, seed = 0): Buffer {
  const buf = Buffer.alloc(size)
  let state = seed || 1
  for (let i = 0; i < buf.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    buf[i] = state & 0xff
  }
  return buf
}

function heapDelta(before: number): number {
  return (process.memoryUsage().heapUsed ?? 0) - before
}

async function resizeBigImage(
  h: Awaited<ReturnType<typeof makeHarness>>,
  file: { path: string; name: string; size: number },
): Promise<void> {
  const out = asFile(
    await resizeImage(h.ctx, [file], { width: 900, maintainAspect: true }),
  )
  const stat = await fsp.stat(out.outputPath)
  expect(stat.size).toBeGreaterThan(0)
}

describe('stress: large-file engines', () => {
  it('converts a ~multi-MB noise PNG without runaway heap growth', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'big.png', noisePng(1800, 1800))
      expect(file.size).toBeGreaterThan(MB)

      const before = process.memoryUsage().heapUsed ?? 0
      const result = asFile(
        await convertImage(h.ctx, [file], { format: 'jpeg', quality: 70, stripMetadata: true }),
      )
      const delta = heapDelta(before)

      expect(result.outputPath.endsWith('.jpg')).toBe(true)
      const header = (await fsp.readFile(result.outputPath)).subarray(0, 2)
      expect(header).toEqual(Buffer.from([0xff, 0xd8]))
      // A single noisy image must not balloon the heap anywhere near the app's
      // realistic working set (generous upper bound to stay CI-stable).
      expect(delta).toBeLessThan(400 * MB)
    } finally {
      await h.cleanup()
    }
  })

  it('resizes a large image without regressing memory', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'big.png', noisePng(1600, 1600))
      const before = process.memoryUsage().heapUsed ?? 0
      await resizeBigImage(h, file)
      const delta = heapDelta(before)
      expect(delta).toBeLessThan(400 * MB)
    } finally {
      await h.cleanup()
    }
  })

  it('round-trips a ~6 MB zip payload and verifies every entry', async () => {
    const h = await makeHarness()
    try {
      const files: Array<{ path: string; name: string; size: number }> = []
      for (let i = 0; i < 3; i++) {
        files.push(await writeFixture(h.dir, `big-${i}.bin`, randomBytes(2 * MB, i + 7)))
      }

      const before = process.memoryUsage().heapUsed ?? 0
      const zipped = asFile(await createZip(files, { level: 1 }, h.ctx))
      const zipStat = await fsp.stat(zipped.outputPath)
      expect(zipStat.size).toBeGreaterThan(0)

      const archive = await JSZip.loadAsync(await fsp.readFile(zipped.outputPath))
      for (let i = 0; i < 3; i++) {
        const entry = archive.file(`big-${i}.bin`)!
        const payload = await entry.async('arraybuffer')
        expect(payload.byteLength).toBe(2 * MB)
      }
      const delta = heapDelta(before)
      expect(delta).toBeLessThan(400 * MB)

      // Repack-extract keeps all the same large entries
      const repacked = asFile(
        await extractZip(
          [{ path: zipped.outputPath, name: zipped.filename }],
          {},
          h.ctx,
        ),
      )
      const repackedZip = await JSZip.loadAsync(await fsp.readFile(repacked.outputPath))
      for (let i = 0; i < 3; i++) {
        expect(repackedZip.file(`big-${i}.bin`)).toBeTruthy()
      }
    } finally {
      await h.cleanup()
    }
  })

  it('aborts deterministically when the signal is already set', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'big.png', noisePng(800, 800))
      const controller = new AbortController()
      controller.abort()
      const ctx = { ...h.ctx, signal: controller.signal }
      try {
        await convertImage(ctx, [file], { format: 'jpeg', quality: 70, stripMetadata: true })
        expect.unreachable('convertImage must not run after abort')
      } catch (err) {
        expect((err as DOMException).name).toBe('AbortError')
      }
    } finally {
      await h.cleanup()
    }
  })

  it('aborts a running large operation and cleans up its output', async () => {
    const h = await makeHarness()
    try {
      const file = await writeFixture(h.dir, 'big.png', noisePng(2400, 2400))
      const controller = new AbortController()
      const ctx = { ...h.ctx, signal: controller.signal }
      const started = convertImage(ctx, [file], { format: 'jpeg', quality: 70, stripMetadata: true })

      await new Promise((r) => setTimeout(r, 25))
      controller.abort()

      let aborted = false
      try {
        await started
      } catch {
        aborted = true
      }
      expect(aborted).toBe(true)
    } finally {
      await h.cleanup()
    }
  })
})