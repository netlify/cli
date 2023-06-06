import { beforeEach, describe, expect, test, vi } from 'vitest'

import {isFeatureFlagEnabled} from '../../../src/utils/feature-flags.mjs'

describe('isFeatureFlagEnabled', () => {

  test('should return true if feature flag is not present', () => {
    const siteInfo = {
      feature_flags: {
        "cool_new_feature": true,
        "amazing_feature": false,
      }
    }

    const result = isFeatureFlagEnabled(siteInfo, 'netlify_feature')

    expect(result).toBe(true)
  })

  test('should return true if feature flag is true', () => {
    const siteInfo = {
      feature_flags: {
        "cool_new_feature": true,
        "amazing_feature": false,
      }
    }

    const result = isFeatureFlagEnabled(siteInfo, 'cool_new_feature')

    expect(result).toBe(true)
  })

  test('should return false if feature flag is false', () => {
    const siteInfo = {
      feature_flags: {
        "cool_new_feature": true,
        "amazing_feature": false,
      }
    }

    const result = isFeatureFlagEnabled(siteInfo, 'amazing_feature')

    expect(result).toBe(false)
  })

})
