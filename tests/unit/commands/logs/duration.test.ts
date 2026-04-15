import { describe, expect, test } from 'vitest'

import { parseDuration } from '../../../../src/commands/logs/duration.js'

describe('parseDuration', () => {
  test('parses single units', () => {
    expect(parseDuration('30s')).toBe(30 * 1000)
    expect(parseDuration('30m')).toBe(30 * 60 * 1000)
    expect(parseDuration('1h')).toBe(60 * 60 * 1000)
    expect(parseDuration('2h')).toBe(2 * 60 * 60 * 1000)
    expect(parseDuration('1d')).toBe(24 * 60 * 60 * 1000)
    expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000)
    expect(parseDuration('1w')).toBe(7 * 24 * 60 * 60 * 1000)
  })

  test('parses compound durations', () => {
    expect(parseDuration('1h30m')).toBe(90 * 60 * 1000)
    expect(parseDuration('2d12h')).toBe((2 * 24 + 12) * 60 * 60 * 1000)
  })

  test('is case insensitive and trims whitespace', () => {
    expect(parseDuration('  1H  ')).toBe(60 * 60 * 1000)
    expect(parseDuration('1H30M')).toBe(90 * 60 * 1000)
  })

  test('returns null for invalid inputs', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('hello')).toBeNull()
    expect(parseDuration('1')).toBeNull()
    expect(parseDuration('1h extra')).toBeNull()
    expect(parseDuration('0h')).toBeNull()
    expect(parseDuration('1y')).toBeNull()
  })
})
