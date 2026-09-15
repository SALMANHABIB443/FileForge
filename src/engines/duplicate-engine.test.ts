import { describe, it, expect } from 'vitest'
import { findDuplicates } from './duplicate-engine'

describe('findDuplicates', () => {
  it('returns empty array for no duplicates', async () => {
    const files = [
      { id: '1', name: 'a.txt', size: 10, type: 'text/plain', lastModified: 1, file: new Blob(['hello']).slice(0, 5) as unknown as File },
      { id: '2', name: 'b.txt', size: 10, type: 'text/plain', lastModified: 1, file: new Blob(['world']).slice(0, 5) as unknown as File },
    ]
    const result = await findDuplicates(files)
    expect(result).toEqual([])
  })

  it('returns empty array for single file', async () => {
    const files = [
      { id: '1', name: 'only.txt', size: 5, type: 'text/plain', lastModified: 1, file: new Blob(['test']).slice(0, 4) as unknown as File },
    ]
    const result = await findDuplicates(files)
    expect(result).toEqual([])
  })

  it('calls onProgress during hashing', async () => {
    const progressCalls: number[] = []
    const files = [
      { id: '1', name: 'a.txt', size: 3, type: 'text/plain', lastModified: 1, file: new Blob(['abc']).slice(0, 3) as unknown as File },
      { id: '2', name: 'b.txt', size: 3, type: 'text/plain', lastModified: 1, file: new Blob(['def']).slice(0, 3) as unknown as File },
    ]
    await findDuplicates(files, (p) => progressCalls.push(p))
    expect(progressCalls.length).toBeGreaterThan(0)
    expect(progressCalls[progressCalls.length - 1]!).toBe(100)
  })
})