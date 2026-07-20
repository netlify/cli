import { describe, expect, test } from 'vitest'

import { EXIT_CODES } from '../../../src/utils/exit-codes.js'

describe('EXIT_CODES', () => {
  test('documents the exit code dictionary', () => {
    expect(EXIT_CODES).toEqual({
      SUCCESS: 0,
      GENERAL_ERROR: 1,
      USAGE_ERROR: 2,
      NON_INTERACTIVE_PROMPT: 4,
    })
  })

  test('keeps every code distinct', () => {
    const codes = Object.values(EXIT_CODES)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
