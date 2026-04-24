import fetch from 'node-fetch'
import { afterAll, describe, expect, test, vi } from 'vitest'

import { authWithNetlify } from '../../../src/utils/gh-auth.js'
import importedOpenBrowser from '../../../src/utils/open-browser.js'

const openBrowser = vi.mocked(importedOpenBrowser)

vi.mock('../../../src/utils/open-browser.js', () => ({
  default: vi.fn(() => Promise.resolve()),
}))

const waitForBrowserOpen = () =>
  new Promise<void>((resolve, reject) => {
    const maxAttempts = 10
    const pollIntervalMs = 200
    let attempts = 0
    const check = () => {
      if (openBrowser.mock.calls.length > 0) {
        resolve()
        return
      }
      attempts += 1
      if (attempts >= maxAttempts) {
        reject(new Error('Timed out waiting for browser to be opened'))
        return
      }
      setTimeout(check, pollIntervalMs)
    }
    check()
  })

describe('gh-auth', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  test('should check if the authWithNetlify is working', async () => {
    const promise = authWithNetlify()
    await waitForBrowserOpen()

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
