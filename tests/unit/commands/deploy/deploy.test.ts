import { describe, expect, test } from 'vitest'

import { isNonInteractive } from '../../../../src/utils/scripted-commands.js'

describe('isNonInteractive', () => {
  test('should return true when CI env var is set', () => {
    const originalCI = process.env.CI
    process.env.CI = 'true'
    try {
      expect(isNonInteractive()).toBe(true)
    } finally {
      if (originalCI === undefined) {
        delete process.env.CI
      } else {
        process.env.CI = originalCI
      }
    }
  })
})
