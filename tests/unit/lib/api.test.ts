import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

import { NetlifyAPI } from '@netlify/api'
import express from 'express'
import { afterEach, describe, expect, test } from 'vitest'

import { findSiteByName, listSitesByRepoUrl } from '../../../src/lib/api.js'

interface SitesRequest {
  query: express.Request['query']
  authorization?: string
}

let server: Server | undefined

const withSitesRoute = async (sites: unknown, status = 200) => {
  const requests: SitesRequest[] = []
  const app = express()
  app.get('/api/v1/sites', (req, res) => {
    requests.push({ query: req.query, authorization: req.headers.authorization })
    res.status(status).json(sites)
  })
  server = app.listen()
  await new Promise((resolve) => server?.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  const api = new NetlifyAPI('test-token', {
    scheme: 'http',
    host: `localhost:${port.toString()}`,
    pathPrefix: '/api/v1',
  })
  return { api, requests }
}

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve))
  server = undefined
})

describe('findSiteByName', () => {
  test('requests an exact server-side match', async () => {
    const { api, requests } = await withSitesRoute([{ id: 'site-1', name: 'my-site' }])

    await expect(findSiteByName(api, 'my-site')).resolves.toMatchObject({ id: 'site-1' })
    expect(requests).toEqual([
      { query: { name: 'my-site', name_match_mode: 'exact', filter: 'all' }, authorization: 'Bearer test-token' },
    ])
  })

  test('ignores substring matches from an API that does not support exact matching', async () => {
    const { api } = await withSitesRoute([
      { id: 'site-1', name: 'my-site-staging' },
      { id: 'site-2', name: 'My-Site' },
    ])

    await expect(findSiteByName(api, 'my-site')).resolves.toMatchObject({ id: 'site-2' })
  })

  test('resolves to undefined when no site has that name', async () => {
    const { api } = await withSitesRoute([{ id: 'site-1', name: 'my-site-staging' }])

    await expect(findSiteByName(api, 'my-site')).resolves.toBeUndefined()
  })

  test('rejects with the response status on API errors', async () => {
    const { api } = await withSitesRoute({ message: 'Unauthorized' }, 401)

    await expect(findSiteByName(api, 'my-site')).rejects.toMatchObject({ status: 401 })
  })
})

describe('listSitesByRepoUrl', () => {
  test('requests a server-side repo filter', async () => {
    const site = {
      id: 'site-1',
      name: 'a',
      build_settings: { provider: 'github', repo_url: 'https://github.com/acme/widget' },
    }
    const { api, requests } = await withSitesRoute([site])

    await expect(listSitesByRepoUrl(api, 'https://github.com/acme/widget')).resolves.toEqual([site])
    expect(requests.map(({ query }) => query)).toEqual([
      { page: '1', per_page: '100', repo_url: 'https://github.com/acme/widget', filter: 'all' },
    ])
  })

  test('filters unrelated sites from an API that does not support the repo filter', async () => {
    const matching = {
      id: 'site-1',
      name: 'a',
      build_settings: { provider: 'github', repo_url: 'https://github.com/Acme/Widget' },
    }
    const { api } = await withSitesRoute([
      matching,
      { id: 'site-2', name: 'b', build_settings: { provider: 'github', repo_url: 'https://github.com/acme/other' } },
      { id: 'site-3', name: 'c' },
    ])

    await expect(listSitesByRepoUrl(api, 'git@github.com:acme/widget.git')).resolves.toEqual([matching])
  })
})
