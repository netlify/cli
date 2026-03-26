import { readFile } from 'fs/promises'
import { join } from 'path'

import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions } from '../../utils/mock-api-vitest.js'
import { startDeployMockApi } from '../deploy/deploy-api-routes.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import type { Route } from '../../utils/mock-api-vitest.js'

const siteInfo = {
  id: 'drop_site_id',
  name: 'test-site',
  account_slug: 'test-account',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
  build_settings: { repo_url: '' },
}

describe('claim', () => {
  test('should claim site via netlify claim command', async (t) => {
    const routes: Route[] = [
      { path: 'sites', method: 'GET', response: [] },
      { path: 'accounts', response: [{ slug: 'test-account', name: 'Test Account', default: true }] },
      {
        path: 'drop/claim',
        method: 'POST',
        response: { message: 'ok' },
      },
      { path: 'sites/drop_site_id', response: siteInfo },
      { path: 'accounts/test-account/env', response: [] },
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
})
