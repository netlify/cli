import http from 'http'
import net from 'net'
import path from 'path'

import { RedirectsHandler } from '@netlify/redirects'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { getWatchers, nodeRequestToWebRequest } from '../../src/utils/rules-proxy.js'

import fetch from 'node-fetch'
import { createSiteBuilder, SiteBuilder } from './utils/site-builder.js'

describe('rules-proxy', () => {
  let server: http.Server
  let builder: SiteBuilder
  beforeAll(async () => {
    builder = createSiteBuilder({ siteName: 'site-with-redirects-file' })
    builder.withRedirectsFile({
      redirects: [{ from: '/something ', to: '/ping', status: 200 }],
    })

    await builder.build()

    const redirectsHandler = new RedirectsHandler({
      configPath: path.join(builder.directory, 'netlify.toml'),
      configRedirects: [],
      geoCountry: undefined,
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: builder.directory,
      publicDir: builder.directory
    })

    server = http.createServer(async function onRequest(req, res) {
      const match = await redirectsHandler.match(nodeRequestToWebRequest(req))
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
    const res = await fetch(`http://localhost:${(server?.address() as net.AddressInfo).port}/something`)
    const body = await res.json()

    expect(body).toHaveProperty('from', '/something')
    expect(body).toHaveProperty('to', '/ping')
    expect(body).toHaveProperty('force', false)
    expect(body).toHaveProperty('host', '')
    expect(body).toHaveProperty('negative', false)
    expect(body).toHaveProperty('scheme', '')
    expect(body).toHaveProperty('status', 200)
  })
})
