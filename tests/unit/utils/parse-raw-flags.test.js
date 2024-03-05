import { describe, expect, test } from 'vitest'

import { aggressiveJSONParse, parseRawFlags } from '../../../dist/utils/parse-raw-flags.js'

describe('parse-raw-flags', () => {
  test('JSONTruthy works with various inputs', () => {
    const testPairs = [
      {
        input: 'true',
        wanted: true,
      },
      {
        input: 'false',
        wanted: false,
      },
      {
        input: JSON.stringify({ foo: 'bar' }),
        wanted: { foo: 'bar' },
      },
      {
        input: 'Hello-world 1234',
        wanted: 'Hello-world 1234',
      },
    ]

    testPairs.forEach((pair) => {
      expect(aggressiveJSONParse(pair.input)).toEqual(pair.wanted)
    })
  })

  test('parseRawFlags works', () => {
    const input = ['FAUNA', 'FOO', 'BAR', '--hey', 'hi', '--heep']

    const expected = { hey: 'hi', heep: true }

    expect(parseRawFlags(input)).toEqual(expected)
  })
})
