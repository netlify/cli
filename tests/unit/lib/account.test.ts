import { describe, expect, test } from 'vitest'

import { supportsBackgroundFunctions } from '../../../src/lib/account.js'

describe('supportsBackgroundFunctions', () => {
  test(`should return false if no account`, () => {
    // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
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
    expect(supportsBackgroundFunctions({ capabilities: { background_functions: { included: 'string' } } })).toEqual(
      true,
    )
  })

  test(`should return true if included property is true`, () => {
    expect(supportsBackgroundFunctions({ capabilities: { background_functions: { included: true } } })).toEqual(true)
  })
})
