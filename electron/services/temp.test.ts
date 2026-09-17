import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import {
  setTempBase,
  tempBaseDir,
  jobTempDir,
  ensureTempBase,
  cleanupJobTemp,
  cleanupOrphanedTemps,
} from './temp'

describe('temp service', () => {
  let base: string

  beforeEach(() => {
    base = mkdtempSync(path.join(os.tmpdir(), 'fileforge-temp-test-'))
    setTempBase(base)
  })

  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true }).catch(() => {})
  })

  it('uses the configured base directory', () => {
    expect(tempBaseDir()).toBe(path.resolve(base))
  })

  it('builds job-specific temp paths with sanitized ids', () => {
    expect(jobTempDir('job_123')).toBe(path.join(base, 'jobs', 'job_123'))
    expect(jobTempDir('bad/id!')).toBe(path.join(base, 'jobs', 'bad_id_'))
  })

  it('ensures the base and jobs directories exist', async () => {
    await ensureTempBase()
    expect(await fs.stat(path.join(base, 'jobs')).catch(() => null)).toBeTruthy()
  })

  it('cleans up a single job temp folder', async () => {
    await ensureTempBase()
    const dir = jobTempDir('job_1')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'x.txt'), 'hello')
    await cleanupJobTemp('job_1')
    await expect(fs.stat(dir)).rejects.toThrow()
  })

  it('removes orphaned job directories on startup cleanup', async () => {
    await ensureTempBase()
    await fs.mkdir(jobTempDir('orphan_a'), { recursive: true })
    await fs.writeFile(jobTempDir('orphan_b'), 'also-a-file', { flag: 'wx' }).catch(() => {})
    await fs.mkdir(jobTempDir('orphan_c'), { recursive: true })

    const removed = await cleanupOrphanedTemps()
    expect(removed).toBe(2)
    await expect(fs.stat(jobTempDir('orphan_a'))).rejects.toThrow()
    await expect(fs.stat(jobTempDir('orphan_c'))).rejects.toThrow()
  })
})