const test = require('ava')

const { aggressiveJSONParse, parseRawFlags } = require('../../../src/utils/parse-raw-flags.cjs')

test.serial('JSONTruthy works with various inputs', (t) => {
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
    t.deepEqual(aggressiveJSONParse(pair.input), pair.wanted)
  })
})

test.serial('parseRawFlags works', (t) => {
  const input = ['FAUNA', 'FOO', 'BAR', '--hey', 'hi', '--heep']

  const expected = { hey: 'hi', heep: true }

  t.deepEqual(parseRawFlags(input), expected, 'parse raw flag parses flags in an expected way')
})
