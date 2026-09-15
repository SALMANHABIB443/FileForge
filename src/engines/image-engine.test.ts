import { describe, expect, it } from 'vitest'
import {
  coerceQuality,
  coerceDimension,
  coerceRotation,
  coerceCrop,
  toImageFormat,
} from '@/engines/image-engine'

describe('coerceQuality', () => {
  it('clamps to the 1-100 percentage scale', () => {
    expect(coerceQuality(50, 85)).toBe(50)
    expect(coerceQuality('80', 85)).toBe(80)
    expect(coerceQuality(0, 85)).toBe(1)
    expect(coerceQuality(150, 85)).toBe(100)
  })

  it('uses the fallback for non-finite values', () => {
    expect(coerceQuality('abc', 85)).toBe(85)
    expect(coerceQuality(undefined, 85)).toBe(85)
    expect(coerceQuality(NaN, 85)).toBe(85)
  })

  it('rounds decimal input', () => {
    expect(coerceQuality('91.6', 85)).toBe(92)
  })
})

describe('coerceDimension', () => {
  it('rounds positive numbers', () => {
    expect(coerceDimension('800', 0)).toBe(800)
    expect(coerceDimension(10.4, 0)).toBe(10)
  })

  it('falls back for empty or invalid input', () => {
    expect(coerceDimension('', 1280)).toBe(1280)
    expect(coerceDimension(undefined, 1280)).toBe(1280)
    expect(coerceDimension('abc', 1280)).toBe(1280)
    expect(coerceDimension(0, 1280)).toBe(1280)
    expect(coerceDimension(-5, 1280)).toBe(1280)
  })
})

describe('coerceRotation', () => {
  it('accepts 90/180/270', () => {
    expect(coerceRotation(90)).toBe(90)
    expect(coerceRotation(180)).toBe(180)
    expect(coerceRotation(270)).toBe(270)
  })

  it('falls back to 0 otherwise', () => {
    expect(coerceRotation(45)).toBe(0)
    expect(coerceRotation('abc')).toBe(0)
    expect(coerceRotation(undefined)).toBe(0)
  })
})

describe('coerceCrop', () => {
  it('parses a valid crop within bounds', () => {
    expect(coerceCrop({ x: 10, y: 20, width: 100, height: 50 }, 1000, 800)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    })
  })

  it('clamps the crop to the source bounds', () => {
    expect(coerceCrop({ x: 900, y: 700, width: 500, height: 300 }, 1000, 800)).toEqual({
      x: 900,
      y: 700,
      width: 100,
      height: 100,
    })
  })

  it('clamps negative x/y to 0', () => {
    expect(coerceCrop({ x: -10, y: -20, width: 50, height: 50 }, 1000, 800)).toMatchObject({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    })
  })

  it('applies defaults when fields are missing', () => {
    expect(coerceCrop({}, 400, 300)).toEqual({ x: 0, y: 0, width: 400, height: 300 })
  })

  it('rejects empty crops', () => {
    expect(coerceCrop(undefined, 400, 300)).toBeUndefined()
    expect(coerceCrop(null, 400, 300)).toBeUndefined()
    expect(coerceCrop('not-an-object', 400, 300)).toBeUndefined()
  })
})

describe('toImageFormat', () => {
  it('maps aliases to canonical formats', () => {
    expect(toImageFormat('jpeg', 'jpeg')).toBe('jpeg')
    expect(toImageFormat('jpg', 'jpeg')).toBe('jpeg')
    expect(toImageFormat('png', 'jpeg')).toBe('png')
    expect(toImageFormat('webp', 'jpeg')).toBe('webp')
  })

  it('falls back for unknown formats', () => {
    expect(toImageFormat('gif', 'jpeg')).toBe('jpeg')
    expect(toImageFormat(undefined, 'png')).toBe('png')
  })
})