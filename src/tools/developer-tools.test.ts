import { describe, it, expect } from 'vitest'
import { processJsonFormat } from './json-format'
import { processBase64 } from './base64-convert'
import { processHash } from './hash-generate'
import { processUuidGenerate } from './uuid-generate'
import { processUrlConvert } from './url-convert'
import { processJwtDecode } from './jwt-decode'
import { processTimestampConvert } from './timestamp-convert'
import type { DeveloperToolResult } from '@/types/developer-tool'

const asString = (result: DeveloperToolResult): string =>
  typeof result === 'string' ? result : Object.values(result).join('')

const asRecord = (result: DeveloperToolResult): Record<string, string> =>
  typeof result === 'string' ? {} : result

describe('processJsonFormat', () => {
  it('formats valid JSON with indent', async () => {
    const result = await processJsonFormat('{"a":1,"b":[true,null]}', { mode: 'format', indent: 2 })
    expect(result).toContain('\n  "a": 1')
  })

  it('minifies valid JSON', async () => {
    const result = await processJsonFormat('{ "a" : 1 , "b" : [ 1 , 2 ] }', { mode: 'minify' })
    expect(result).toBe('{"a":1,"b":[1,2]}')
  })

  it('throws on invalid JSON', async () => {
    await expect(processJsonFormat('{oops', { mode: 'format' })).rejects.toThrow(/not valid JSON/)
  })

  it('throws on empty input', async () => {
    await expect(processJsonFormat('   ', { mode: 'format' })).rejects.toThrow(/enter some JSON/)
  })
})

describe('processBase64', () => {
  it('encodes text', async () => {
    const result = await processBase64('hello', { mode: 'encode' })
    expect(result).toBe('aGVsbG8=')
  })

  it('encodes and decodes unicode text round-trip', async () => {
    const text = 'héllo 世界'
    const encoded = asString(await processBase64(text, { mode: 'encode' }))
    const decoded = await processBase64(encoded, { mode: 'decode' })
    expect(decoded).toBe(text)
  })

  it('decodes valid base64', async () => {
    const result = await processBase64('aGVsbG8=', { mode: 'decode' })
    expect(result).toBe('hello')
  })

  it('throws on invalid base64', async () => {
    await expect(processBase64('%%%', { mode: 'decode' })).rejects.toThrow(/not valid Base64/)
  })

  it('throws on non-UTF8 decoded data', async () => {
    await expect(processBase64('AP8=', { mode: 'decode' })).rejects.toThrow(/not UTF-8/)
  })
})

describe('processHash', () => {
  it('computes SHA-256 of abc', async () => {
    const result = await processHash('abc', { algorithm: 'SHA-256' })
    expect(result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('computes SHA-512 of abc', async () => {
    const result = await processHash('abc', { algorithm: 'SHA-512' })
    expect(result).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    )
  })

  it('throws on empty input', async () => {
    await expect(processHash('', { algorithm: 'SHA-256' })).rejects.toThrow(/text to hash/)
  })
})

describe('processUuidGenerate', () => {
  it('generates a single v4 uuid', async () => {
    const result = await processUuidGenerate('', { count: 1 })
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('generates multiple uuids separated by newlines', async () => {
    const result = asString(await processUuidGenerate('', { count: 3 }))
    const uuids = result.split('\n')
    expect(uuids).toHaveLength(3)
    uuids.forEach((u) => expect(u).toMatch(/^[0-9a-f-]{36}$/))
  })

  it('clamps count to the allowed range', async () => {
    const min = asString(await processUuidGenerate('', { count: 0 }))
    const max = asString(await processUuidGenerate('', { count: 1000 }))
    expect(min.split('\n')).toHaveLength(1)
    expect(max.split('\n')).toHaveLength(100)
  })
})

describe('processUrlConvert', () => {
  it('encodes a url string', async () => {
    const result = await processUrlConvert('hello world&foo=1', { mode: 'encode' })
    expect(result).toBe('hello%20world%26foo%3D1')
  })

  it('decodes a percent-encoded string', async () => {
    const result = await processUrlConvert('hello%20world%26foo%3D1', { mode: 'decode' })
    expect(result).toBe('hello world&foo=1')
  })

  it('throws on malformed percent encoding', async () => {
    await expect(processUrlConvert('%zz', { mode: 'decode' })).rejects.toThrow(/percent-encoded/)
  })
})

describe('processJwtDecode', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

  it('decodes header and payload', async () => {
    const out = asRecord(await processJwtDecode(token, {}))
    expect(out.Header).toContain('"alg": "HS256"')
    expect(out.Payload).toContain('"sub": "1234567890"')
    expect(out.Payload).toContain('"iat": 1516239022')
  })

  it('throws when token does not have three parts', async () => {
    await expect(processJwtDecode('only.two', {})).rejects.toThrow(/three dot-separated parts/)
  })

  it('throws on empty input', async () => {
    await expect(processJwtDecode('', {})).rejects.toThrow(/JWT token/)
  })

  it('throws on malformed header segment', async () => {
    await expect(processJwtDecode('!!!.eyJzdWIiOiIxMiJ9.sig', {})).rejects.toThrow(/header/)
  })
})

describe('processTimestampConvert', () => {
  it('returns current-time entries without input', async () => {
    const out = asRecord(await processTimestampConvert('', { unit: 'seconds' }))
    expect(out['Now — timestamp (s)']).toBeDefined()
    expect(out['Now — ISO']).toBeDefined()
  })

  it('converts a seconds timestamp', async () => {
    const out = asRecord(await processTimestampConvert('0', { unit: 'seconds' }))
    expect(out['Input — seconds']).toBe('0')
    expect(out['Input — ISO']).toBe('1970-01-01T00:00:00.000Z')
  })

  it('treats input as milliseconds when requested', async () => {
    const out = asRecord(await processTimestampConvert('1700000000000', { unit: 'milliseconds' }))
    expect(out['Input — milliseconds']).toBe('1700000000000')
    expect(out['Input — ISO']).toBe('2023-11-14T22:13:20.000Z')
  })

  it('throws on non-numeric input', async () => {
    await expect(processTimestampConvert('yesterday', { unit: 'seconds' })).rejects.toThrow(/numeric/)
  })
})