import path from 'node:path'
import fs from 'node:fs/promises'

const BASE_NAME = 'FileForge'
let baseDir: string | null = null

/**
 * Configure the temp base directory. Called from the main process with
 * `app.getPath('temp')`; injectable for tests.
 */
export function setTempBase(dir: string): void {
  baseDir = path.resolve(dir)
}

export function tempBaseDir(): string {
  return baseDir ?? path.join(process.cwd(), `.${BASE_NAME.toLowerCase()}-temp`)
}

function jobsDir(): string {
  return path.join(tempBaseDir(), 'jobs')
}

export function jobTempDir(jobId: string): string {
  return path.join(jobsDir(), safeJobId(jobId))
}

function safeJobId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export async function ensureTempBase(): Promise<void> {
  await fs.mkdir(tempBaseDir(), { recursive: true })
  await fs.mkdir(jobsDir(), { recursive: true })
}

export async function cleanupJobTemp(jobId: string): Promise<void> {
  await fs.rm(jobTempDir(jobId), { recursive: true, force: true })
}

/**
 * Removes every per-job temp folder. Runs once at app start to clear
 * orphaned directories left behind after an unexpected exit.
 */
export async function cleanupOrphanedTemps(): Promise<number> {
  let removed = 0
  try {
    const entries = await fs.readdir(jobsDir())
    for (const entry of entries) {
      const target = path.join(jobsDir(), entry)
      try {
        const stat = await fs.stat(target)
        if (stat.isDirectory()) {
          await fs.rm(target, { recursive: true, force: true })
          removed++
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // jobs dir does not exist yet
  }
  return removed
}