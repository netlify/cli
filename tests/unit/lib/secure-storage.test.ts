import { describe, expect, test } from 'vitest'

import { getLegacyConfigFilePath, isLegacyAuthStorageForced } from '../../../src/lib/secure-storage.js'

describe('isLegacyAuthStorageForced', () => {
  test('returns true when the env var is non-empty', () => {
    const previous = process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
    process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = '1'
    try {
      expect(isLegacyAuthStorageForced()).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
      else process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = previous
    }
  })

  test('returns false when the env var is unset', () => {
    const previous = process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
    delete process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
    try {
      expect(isLegacyAuthStorageForced()).toBe(false)
    } finally {
      if (previous !== undefined) process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = previous
    }
  })

  test('returns false when the env var is empty', () => {
    const previous = process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
    process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = ''
    try {
      expect(isLegacyAuthStorageForced()).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
      else process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = previous
    }
  })
})

describe('getLegacyConfigFilePath', () => {
  test('resolves to a config.json under the OS-appropriate config dir', () => {
    const resolved = getLegacyConfigFilePath()
    expect(resolved).toMatch(/[\\/]netlify[\\/]config\.json$/)
  })
})
