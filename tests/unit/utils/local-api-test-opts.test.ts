import { describe, expect, test } from 'vitest'

import { getLocalApiTestOpts } from '../../../src/utils/local-api-test-opts.js'

describe('getLocalApiTestOpts', () => {
  test('returns host and scheme for localhost', () => {
    expect(getLocalApiTestOpts({ host: 'localhost:1234', scheme: 'http' })).toEqual({
      host: 'localhost:1234',
      scheme: 'http',
    })
  })

  test('returns host and scheme for 127.0.0.1', () => {
    expect(getLocalApiTestOpts({ host: '127.0.0.1:1234', scheme: 'http' })).toEqual({
      host: '127.0.0.1:1234',
      scheme: 'http',
    })
  })

  test('returns host and scheme for [::1]', () => {
    expect(getLocalApiTestOpts({ host: '[::1]:1234', scheme: 'http' })).toEqual({
      host: '[::1]:1234',
      scheme: 'http',
    })
  })

  test.each(['api.netlify.com', 'api-staging.netlify.com', 'example.com:8080', 'localhost.example.com'])(
    'returns undefined for non-loopback host %s',
    (host) => {
      expect(getLocalApiTestOpts({ host, scheme: 'https' })).toBeUndefined()
    },
  )

  test('returns undefined when host is undefined', () => {
    expect(getLocalApiTestOpts({ host: undefined, scheme: 'http' })).toBeUndefined()
  })

  test('returns undefined when host cannot be parsed', () => {
    expect(getLocalApiTestOpts({ host: 'not a host', scheme: 'http' })).toBeUndefined()
  })
})
