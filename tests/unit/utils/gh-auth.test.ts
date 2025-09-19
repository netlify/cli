import { fibonacci } from 'backoff'

import { afterAll, describe, expect, test, vi } from 'vitest'

import { authWithNetlify } from '../../../src/utils/gh-auth.js'
import importedOpenBrowser from '../../../src/utils/open-browser.js'

const openBrowser = vi.mocked(importedOpenBrowser)

vi.mock('../../../src/utils/open-browser.js', () => ({
  default: vi.fn(() => Promise.resolve()),
}))

describe('gh-auth', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  test('should check if the authWithNetlify is working', async () => {
    const promise = authWithNetlify()
    // wait for server to be started
    await new Promise<void>((resolve, reject) => {
      const fibonacciBackoff = fibonacci()
      const check = () => {
        if (openBrowser.mock.calls.length === 0) {
          fibonacciBackoff.backoff()
        } else {
          resolve()
        }
      }

      fibonacciBackoff.failAfter(10)
      fibonacciBackoff.on('ready', check)
      fibonacciBackoff.on('fail', reject)
      check()
    })

    const params = new URLSearchParams([
      ['user', 'spongebob'],
      ['token', 'gho_some-token'],
      ['provider', 'github'],
    ])

    const [[{ url }]] = openBrowser.mock.calls
    const calledParams = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    const host = calledParams.get('host')

    // perform a request like the redirect from the Web ui
    await fetch(new URL(`?${params.toString()}`, host ?? undefined))
    const result = await promise

    expect(result).toEqual({
      user: 'spongebob',
      token: 'gho_some-token',
      provider: 'github',
    })
  })
})
