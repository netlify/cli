import { readFile } from 'fs/promises'
import { join } from 'path'

import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions } from '../../utils/mock-api-vitest.js'
import { startDeployMockApi } from '../deploy/deploy-api-routes.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import type { Route } from '../../utils/mock-api-vitest.js'
import type express from 'express'

const siteInfo = {
  id: 'drop_site_id',
  name: 'test-site',
  account_slug: 'test-account',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
  build_settings: { repo_url: '' },
}

const baseRoutes: Route[] = [
  { path: 'sites', method: 'GET', response: [] },
  { path: 'accounts', response: [{ slug: 'test-account', name: 'Test Account', default: true }] },
  { path: 'sites/drop_site_id', response: siteInfo },
  { path: 'accounts/test-account/env', response: [] },
]

describe('claim', () => {
  test('should claim site via netlify claim command', async (t) => {
    const routes: Route[] = [
      ...baseRoutes,
      {
        path: 'drop/claim',
        method: 'POST',
        response: { message: 'ok' },
      },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const output = (await callCli(
          ['claim', 'drop_site_id', '--token', 'drop-jwt-token'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '' },
          }),
        )) as string

        expect(output).toContain('claimed successfully')

        const claimReq = mockApi.requests.find((r) => r.path.includes('/drop/claim'))
        expect(claimReq).toBeDefined()
        expect(claimReq?.method).toBe('POST')
        const claimBody = claimReq?.body as { site: string; token: string }
        expect(claimBody.site).toBe('drop_site_id')
        expect(claimBody.token).toBe('drop-jwt-token')

        const stateJson = JSON.parse(await readFile(join(builder.directory, '.netlify', 'state.json'), 'utf-8')) as {
          siteId: string
        }
        expect(stateJson.siteId).toBe('drop_site_id')
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should error on invalid or expired token (401)', async (t) => {
    const routes: Route[] = [
      ...baseRoutes,
      {
        path: 'drop/claim',
        method: 'POST',
        response: (_req: express.Request, res: express.Response) => {
          res.status(401)
          res.json({ message: 'Invalid or expired token' })
        },
      },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const rejected = callCli(
          ['claim', 'drop_site_id', '--token', 'expired-token'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow(/Failed to claim site/)
        await expect(rejected).rejects.toThrow(/401/)

        const stateExists = await readFile(join(builder.directory, '.netlify', 'state.json'), 'utf-8').catch(() => null)
        expect(stateExists).toBeNull()
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should error when site is already claimed (409)', async (t) => {
    const routes: Route[] = [
      ...baseRoutes,
      {
        path: 'drop/claim',
        method: 'POST',
        response: (_req: express.Request, res: express.Response) => {
          res.status(409)
          res.json({ message: 'Site has already been claimed' })
        },
      },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const rejected = callCli(
          ['claim', 'drop_site_id', '--token', 'drop-jwt-token'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow(/Failed to claim site/)
        await expect(rejected).rejects.toThrow(/409/)

        const stateExists = await readFile(join(builder.directory, '.netlify', 'state.json'), 'utf-8').catch(() => null)
        expect(stateExists).toBeNull()
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should error on network failure', async (t) => {
    const routes: Route[] = [
      ...baseRoutes,
      {
        path: 'drop/claim',
        method: 'POST',
        response: (_req: express.Request, res: express.Response) => {
          res.destroy()
        },
      },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const rejected = callCli(
          ['claim', 'drop_site_id', '--token', 'drop-jwt-token'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow()

        const stateExists = await readFile(join(builder.directory, '.netlify', 'state.json'), 'utf-8').catch(() => null)
        expect(stateExists).toBeNull()
      })
    } finally {
      await mockApi.close()
    }
  })
})
