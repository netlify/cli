import { describe, expect, test } from 'vitest'

import { supportsBackgroundFunctions } from '../../../src/lib/account.js'

describe('supportsBackgroundFunctions', () => {
  test(`should return false if no account`, () => {
    expect(supportsBackgroundFunctions()).toEqual(false)
  })

  test(`should return false if no capabilities`, () => {
    expect(supportsBackgroundFunctions({})).toEqual(false)
  })

  test(`should return false if capability missing`, () => {
    expect(supportsBackgroundFunctions({ capabilities: {} })).toEqual(false)
  })

  test(`should return false if included property missing on capability missing`, () => {
    expect(supportsBackgroundFunctions({ capabilities: { background_functions: {} } })).toEqual(false)
  })

  test(`should return false if included property is false`, () => {
    expect(supportsBackgroundFunctions({ capabilities: { background_functions: { included: false } } })).toEqual(false)
  })

  test(`should return true if included property is truthy`, () => {
    // @ts-expect-error Intentional incorrect type. TODO(serhalp): Remove this test? Can this happen?
    expect(supportsBackgroundFunctions({ capabilities: { background_functions: { included: 'string' } } })).toEqual(
      true,
    )
  })

  test(`should return true if included property is true`, () => {
    expect(supportsBackgroundFunctions({ capabilities: { background_functions: { included: true } } })).toEqual(true)
  })
})
