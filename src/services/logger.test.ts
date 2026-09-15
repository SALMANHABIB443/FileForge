import { describe, expect, it } from 'vitest'
import { logger } from '@/services/logger'

async function resetLogs(): Promise<void> {
  await logger.clear()
}

describe('logger', () => {
  it('keeps in-memory logs with level, context and timestamp', async () => {
    await resetLogs()
    logger.info('hello', 'unit')
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    const entry = logs[0]!
    expect(entry).toMatchObject({ level: 'info', message: 'hello', context: 'unit' })
    expect(typeof entry.timestamp).toBe('number')
  })

  it('buildExport returns a diagnostics payload including session logs', async () => {
    await resetLogs()
    logger.error('boom', 'unit', 'detail')
    const payload = await logger.buildExport()
    expect(payload.exportedAt).toBeTruthy()
    expect(payload.logs.length).toBeGreaterThanOrEqual(1)
    const err = payload.logs.find((l) => l.level === 'error' && l.message === 'boom')
    expect(err).toBeTruthy()
  })

  it('recordCrash stores an error entry without throwing', async () => {
    await resetLogs()
    logger.recordCrash('test crash', '[name=Error]', { version: '0.0.1', userAgent: 'test-ua' })
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    const entry = logs[0]!
    expect(entry.level).toBe('error')
    expect(entry.message).toContain('Crash snapshot')
  })

  it('clear removes all in-memory logs', async () => {
    logger.info('a')
    logger.info('b')
    await resetLogs()
    expect(logger.getLogs()).toHaveLength(0)
  })
})