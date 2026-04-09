import { describe, expect, test } from 'vitest'

import { isFeatureFlagEnabled } from '../../../src/utils/feature-flags.js'

describe('isFeatureFlagEnabled', () => {
  test('should return true if feature flag is not present', () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: true,
        amazing_feature: false,
      },
    }

    const result = isFeatureFlagEnabled('netlify_feature', siteInfo)

    expect(result).toBe(true)
  })

  test('should return true if feature flag is true', () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: true,
        amazing_feature: false,
      },
    }

    const result = isFeatureFlagEnabled('cool_new_feature', siteInfo)

    expect(result).toBe(true)
  })

  test('should return true if feature flag is a string', () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: 'my string',
        amazing_feature: false,
      },
    }

    const result = isFeatureFlagEnabled('cool_new_feature', siteInfo)

    expect(result).toBe(true)
  })

  test('should return true if feature flag is a number', () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: 42,
        amazing_feature: false,
      },
    }

    const result = isFeatureFlagEnabled(
      'cool_new_feature',
      // @ts-expect-error: Intentionally breaking type contract
      siteInfo,
    )

    expect(result).toBe(true)
  })

  test('should return true if feature flag is an object', () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: { key: 'value' },
        amazing_feature: false,
      },
    }

    const result = isFeatureFlagEnabled(
      'cool_new_feature',
      // @ts-expect-error: Intentionally breaking type contract
      siteInfo,
    )

    expect(result).toBe(true)
  })

  test('should return false if feature flag is false', () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: true,
        amazing_feature: false,
      },
    }

    const result = isFeatureFlagEnabled('amazing_feature', siteInfo)

    expect(result).toBe(false)
  })
})
