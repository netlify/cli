import { env } from 'process'

import { describe, expect, test } from 'vitest'

import { getBootstrapURL, FALLBACK_BOOTSTRAP_URL } from '../../../../dist/lib/edge-functions/bootstrap.js'

describe('`getBootstrapURL()`', () => {
  test('Returns the URL in the `NETLIFY_EDGE_BOOTSTRAP` URL, if set', async () => {
    const mockBootstrapURL = 'https://edge.netlify/bootstrap.ts'

    env.NETLIFY_EDGE_BOOTSTRAP = mockBootstrapURL

    const bootstrapURL = await getBootstrapURL()

    delete env.NETLIFY_EDGE_BOOTSTRAP

    expect(bootstrapURL).toEqual(mockBootstrapURL)
  })

  test('Returns a publicly accessible URL', { retry: 3 }, async () => {
    const bootstrapURL = await getBootstrapURL()

    // We shouldn't get the fallback URL, because that means we couldn't get
    // the URL from the `@netlify/edge-functions` module.
    expect(bootstrapURL).not.toBe(FALLBACK_BOOTSTRAP_URL)

    const res = await fetch(bootstrapURL)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type').startsWith('application/typescript')).toBe(true)
  })
})
