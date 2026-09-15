import { describe, expect, it } from 'vitest'
import { parseRanges, coerceRotation } from '@/engines/pdf-engine'

describe('parseRanges', () => {
  it('parses a single page', () => {
    expect(parseRanges('3', 10)).toEqual([3])
  })

  it('parses a hyphenated range', () => {
    expect(parseRanges('2-5', 10)).toEqual([2, 3, 4, 5])
  })

  it('parses a comma-separated mix', () => {
    expect(parseRanges('1, 3-4, 7', 10)).toEqual([1, 3, 4, 7])
  })

  it('deduplicates overlapping ranges', () => {
    expect(parseRanges('1-3, 2-4', 10)).toEqual([1, 2, 3, 4])
  })

  it('trims whitespace and ignores empty segments', () => {
    expect(parseRanges(' 1 , , 2 ', 10)).toEqual([1, 2])
  })

  it('sorts output ascending', () => {
    expect(parseRanges('9, 2, 5-6', 10)).toEqual([2, 5, 6, 9])
  })

  it('throws on empty input', () => {
    expect(() => parseRanges('', 10)).toThrowError(/Enter a page range/)
  })

  it('throws when start exceeds end', () => {
    expect(() => parseRanges('5-2', 10)).toThrowError(/outside the document/)
  })

  it('throws when a page is out of bounds', () => {
    expect(() => parseRanges('11', 10)).toThrowError(/outside the document/)
    expect(() => parseRanges('0', 10)).toThrowError(/outside the document/)
  })

  it('throws on invalid syntax', () => {
    expect(() => parseRanges('abc', 10)).toThrowError(/Invalid range/)
  })
})

describe('coerceRotation', () => {
  it('accepts 90, 180 and 270', () => {
    expect(coerceRotation(90)).toBe(90)
    expect(coerceRotation(180)).toBe(180)
    expect(coerceRotation(270)).toBe(270)
    expect(coerceRotation('90')).toBe(90)
  })

  it('falls back to 0 for anything else', () => {
    expect(coerceRotation(0)).toBe(0)
    expect(coerceRotation(45)).toBe(0)
    expect(coerceRotation(-90)).toBe(0)
    expect(coerceRotation('abc')).toBe(0)
    expect(coerceRotation(undefined)).toBe(0)
    expect(coerceRotation(null)).toBe(0)
  })
})