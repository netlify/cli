import http from 'http'
import net from 'net'
import path from 'path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createRewriter, getWatchers } from '../../src/utils/rules-proxy.mjs'

import got from './utils/got.cjs'
import { createSiteBuilder, SiteBuilder } from './utils/site-builder.cjs'

describe('rules-proxy', () => {
  let server: http.Server
  let builder: SiteBuilder
  beforeAll(async () => {
    builder = createSiteBuilder({ siteName: 'site-with-redirects-file' })
    builder.withRedirectsFile({
      redirects: [{ from: '/something ', to: '/ping', status: 200 }],
    })

    await builder.build()

    const rewriter = await createRewriter({
      distDir: builder.directory,
      projectDir: builder.directory,
      jwtSecret: '',
      jwtRoleClaim: '',
      geoCountry: undefined,
      configPath: path.join(builder.directory, 'netlify.toml'),
    })
    server = http.createServer(async function onRequest(req, res) {
      const match = await rewriter(req)
      res.end(JSON.stringify(match))
    })

    return new Promise((resolve) => {
      server.listen(resolve)
    })
  })

  afterAll(async () => {
    await new Promise((resolve) => {
      server.on('close', resolve)
      server.close()
    })
    await Promise.all(getWatchers().map((watcher) => watcher.close()))
    await builder.cleanup()
  })

  test('should apply re-write rule based on _redirects file', async () => {
    const response = await got(`http://localhost:${(server?.address() as net.AddressInfo).port}/something`).json()

    expect(response.from).toBe('/something')
    expect(response.to).toBe('/ping')
    expect(response.force).toBe(false)
    expect(response.host).toBe('')
    expect(response.negative).toBe(false)
    expect(response.scheme).toBe('')
    expect(response.status).toBe(200)
  })
})
