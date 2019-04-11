const test = require('ava')
const { parseRawFlags, aggressiveJSONParse } = require('./parse-raw-flags')

test.serial('JSONTruthy works with various inputs', async t => {
  const testPairs = [
    {
      input: 'true',
      wanted: true
    },
    {
      input: 'false',
      wanted: false
    },
    {
      input: JSON.stringify({ foo: 'bar' }),
      wanted: { foo: 'bar' }
    },
    {
      input: 'Hello-world 1234',
      wanted: 'Hello-world 1234'
    }
  ]

  testPairs.forEach(pair => {
    t.deepEqual(aggressiveJSONParse(pair.input), pair.wanted)
  })
})

test.serial('parseRawFlags works', async t => {
  const input = [
    { type: 'arg', input: 'FAUNA' },
    { type: 'arg', input: 'FOO' },
    { type: 'arg', input: 'BAR' },
    { type: 'arg', input: '--hey' },
    { type: 'arg', input: 'hi' },
    { type: 'arg', input: '--heep' }
  ]

  const expected = { hey: 'hi', heep: true }

  t.deepEqual(parseRawFlags(input), expected, 'parse raw flag parses flags in an expected way')
})
