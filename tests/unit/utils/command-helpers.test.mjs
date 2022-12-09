import { describe, expect, test } from 'vitest'

import { normalizeConfig } from '../../../src/utils/command-helpers.mjs'

describe('normalizeConfig', () => {
  test('should remove publish and publishOrigin property if publishOrigin is "default"', () => {
    const config = { build: { publish: 'a', publishOrigin: 'default' } }

    expect(normalizeConfig(config)).toEqual({ build: {} })
  })

  test('should return same config object if publishOrigin is not "default"', () => {
    const config = { build: { publish: 'a', publishOrigin: 'b' } }

    expect(normalizeConfig(config)).toBe(config)
  })
})
