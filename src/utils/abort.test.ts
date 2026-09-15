import { describe, expect, it } from 'vitest'
import { checkAbort } from '@/utils/abort'

describe('checkAbort', () => {
  it('does nothing when no signal is provided', () => {
    expect(() => checkAbort()).not.toThrow()
  })

  it('does nothing when the signal is not aborted', () => {
    const controller = new AbortController()
    expect(() => checkAbort(controller.signal)).not.toThrow()
  })

  it('throws AbortError when the signal is aborted', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => checkAbort(controller.signal)).toThrowError('Operation cancelled')
    try {
      checkAbort(controller.signal)
    } catch (err) {
      expect((err as DOMException).name).toBe('AbortError')
    }
  })
})