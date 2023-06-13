import { describe, expect, test } from 'vitest'

import { isFeatureFlagEnabled } from '../../../src/utils/feature-flags.mjs'

describe('isFeatureFlagEnabled', () => {
  test('should return true if feature flag is not present', async () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: true,
        amazing_feature: false,
      },
    }

    const api = { getSite: () => siteInfo }

    const result = await isFeatureFlagEnabled('netlify_feature', api, 'site id')

    expect(result).toBe(true)
  })

  test('should return true if feature flag is true', async () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: true,
        amazing_feature: false,
      },
    }
    const api = { getSite: () => siteInfo }

    const result = await isFeatureFlagEnabled('cool_new_feature', api, 'site id')

    expect(result).toBe(true)
  })

  test('should return true if feature flag is a string', async () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: 'my string',
        amazing_feature: false,
      },
    }
    const api = { getSite: () => siteInfo }

    const result = await isFeatureFlagEnabled('cool_new_feature', api, `site id`)

    expect(result).toBe(true)
  })

  test('should return true if feature flag is a number', async () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: 42,
        amazing_feature: false,
      },
    }

    const api = { getSite: () => siteInfo }

    const result = await isFeatureFlagEnabled('cool_new_feature', api, `site id`)

    expect(result).toBe(true)
  })

  test('should return true if feature flag is an object', async () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: { key: 'value' },
        amazing_feature: false,
      },
    }

    const api = { getSite: () => siteInfo }

    const result = await isFeatureFlagEnabled('cool_new_feature', api, `site id`)

    expect(result).toBe(true)
  })

  test('should return false if feature flag is false', async () => {
    const siteInfo = {
      feature_flags: {
        cool_new_feature: true,
        amazing_feature: false,
      },
    }

    const api = { getSite: () => siteInfo }

    const result = await isFeatureFlagEnabled('amazing_feature', api, 'side id')

    expect(result).toBe(false)
  })
})
