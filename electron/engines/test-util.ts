import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { EngineContext, EngineFileResult, EngineResult } from './types'

export interface TestHarness {
  dir: string
  ctx: EngineContext
  cleanup(): Promise<void>
}

export async function makeHarness(): Promise<TestHarness> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ff-engine-'))
  return {
    dir,
    ctx: {
      workDir: dir,
      signal: new AbortController().signal,
      onProgress: () => {},
    },
    cleanup: () => fsp.rm(dir, { recursive: true, force: true }),
  }
}

export async function writeFixture(
  dir: string,
  name: string,
  data: Uint8Array | ArrayBuffer | string,
): Promise<{ path: string; name: string; size: number }> {
  const filePath = path.join(dir, name)
  const payload =
    typeof data === 'string'
      ? data
      : data instanceof ArrayBuffer
        ? Buffer.from(data)
        : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  await fsp.writeFile(filePath, payload)
  const stat = await fsp.stat(filePath)
  return { path: filePath, name, size: stat.size }
}

export function asFile(result: EngineResult): EngineFileResult {
  if (result.kind !== 'file') {
    throw new Error('Expected an engine file result')
  }
  return result
}

/** Builds a single-file TAR archive from raw entries with valid checksums. */
export function buildTar(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const block: Buffer[] = []
  for (const entry of entries) {
    const header = Buffer.alloc(512)
    header.write(entry.name.slice(0, 100), 0, 'ascii')
    header.write('0000644\0', 100, 'ascii')
    header.write('0000000\0', 108, 'ascii')
    header.write('0000000\0', 116, 'ascii')
    const sizeField = entry.data.length.toString(8).padStart(11, '0') + '\0'
    header.write(sizeField, 124, 'ascii')
    header.write('0'.repeat(12), 136, 'ascii')
    header.write('        ', 148, 'ascii')
    header[156] = 0x30
    const sum = computeTarChecksum(header)
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii')
    block.push(header)
    const padded = Buffer.alloc(Math.ceil(entry.data.length / 512) * 512)
    entry.data.copy(padded)
    block.push(padded)
  }
  return Buffer.concat([...block, Buffer.alloc(1024)])
}

function computeTarChecksum(header: Buffer): number {
  let sum = 0
  for (let i = 0; i < 512; i++) {
    sum += i >= 148 && i < 156 ? 32 : header[i]!
  }
  return sum
}