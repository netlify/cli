import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions } from '../../utils/mock-api-vitest.js'
import { startDeployMockApi } from './deploy-api-routes.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import type { Route } from '../../utils/mock-api-vitest.js'
import type express from 'express'

const dropDeployResponse = {
  id: 'drop_site_id',
  deploy_id: 'drop_deploy_id',
  subdomain: 'anon-test-site',
  url: 'https://anon-test-site.netlify.app',
  state: 'prepared',
  required: [],
}

const createDropRoutes = (options?: { rateLimited?: boolean }): Route[] => [
  { path: 'sites', method: 'GET', response: [] },
  { path: 'accounts', response: [{ slug: 'test-account', name: 'Test Account', default: true }] },
  {
    path: 'drop/token',
    method: 'POST',
    response: options?.rateLimited
      ? (_req: express.Request, res: express.Response) => {
          res.status(429)
          res.json({ code: 429, message: "You've reached the daily limit. Sign up for free to continue." })
        }
      : { token: 'drop-jwt-token' },
  },
  {
    path: 'drop',
    method: 'POST',
    response: dropDeployResponse,
  },
  {
    path: 'deploys/drop_deploy_id/files/{*filepath}',
    method: 'PUT',
    response: { message: 'ok' },
  },
  {
    path: 'sites/drop_site_id/deploys/drop_deploy_id',
    method: 'GET',
    response: {
      ...dropDeployResponse,
      state: 'ready',
      ssl_url: 'https://anon-test-site.netlify.app',
    },
  },
  {
    path: 'drop/claim',
    method: 'POST',
    response: { message: 'ok' },
  },
]

const siteInfo = {
  id: 'site_id',
  name: 'test-site',
  account_slug: 'test-account',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
  build_settings: { repo_url: '' },
}

interface AnonymousDeployOutput {
  site_id: string
  site_url: string
  deploy_id: string
  claim_url: string
  claim_command: string
  password?: string
}

describe('deploy --allow-anonymous', () => {
  test('should deploy anonymously via Drop API when not logged in', async (t) => {
    const routes = createDropRoutes()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )) as string

        const deploy = JSON.parse(output) as AnonymousDeployOutput
        expect(deploy.site_id).toBe('drop_site_id')
        expect(deploy.deploy_id).toBe('drop_deploy_id')
        expect(deploy.site_url).toBe('https://anon-test-site.netlify.app')
        expect(deploy.claim_url).toContain('app.netlify.com/drop/')
        expect(deploy.claim_url).toContain('drop_token=')
        expect(deploy.claim_command).toContain('--claim-site')
        expect(deploy.claim_command).toContain('--claim-token')
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should include password in output when created_via is drop (default)', async (t) => {
    const routes = createDropRoutes()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )) as string

        const deploy = JSON.parse(output) as AnonymousDeployOutput
        expect(deploy.password).toBe('My-Drop-Site')
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should not include password when --created-via is not drop', async (t) => {
    const routes = createDropRoutes()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--allow-anonymous', '--created-via', 'integration'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )) as string

        const deploy = JSON.parse(output) as AnonymousDeployOutput
        expect(deploy.password).toBeUndefined()
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should send correct headers and body to Drop API', async (t) => {
    const routes = createDropRoutes()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )

        const dropTokenReq = mockApi.requests.find((r) => r.path.includes('/drop/token'))
        expect(dropTokenReq).toBeDefined()
        expect(dropTokenReq?.headers.referer).toBe('https://app.netlify.com')

        const dropCreateReq = mockApi.requests.find(
          (r) => r.path.includes('/drop') && r.method === 'POST' && !r.path.includes('/token'),
        )
        expect(dropCreateReq).toBeDefined()
        expect(dropCreateReq?.headers.referer).toBe('https://app.netlify.com')
        const createBody = dropCreateReq?.body as { files: Record<string, string>; token: string }
        expect(createBody.token).toBe('drop-jwt-token')
        expect(createBody.files).toBeDefined()
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should fall through to normal deploy when logged in with --allow-anonymous', async (t) => {
    const routes: Route[] = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites', method: 'GET', response: [siteInfo] },
      { path: 'accounts', response: [{ slug: 'test-account' }] },
      { path: 'accounts/test-account/env', response: [] },
      { path: 'sites/site_id/deploys', method: 'GET', response: [] },
      {
        path: 'sites/site_id/deploys',
        method: 'POST',
        response: {
          id: 'deploy_id',
          site_id: 'site_id',
          deploy_ssl_url: 'https://test-site.netlify.app',
          state: 'prepared',
          required: [],
          required_functions: [],
        },
      },
      {
        path: 'sites/site_id/deploys/deploy_id',
        method: 'PUT',
        response: { id: 'deploy_id', site_id: 'site_id', state: 'prepared', required: [], required_functions: [] },
      },
      {
        path: 'sites/site_id/deploys/deploy_id',
        method: 'GET',
        response: { id: 'deploy_id', site_id: 'site_id', state: 'ready' },
      },
      {
        path: 'deploys/deploy_id',
        method: 'GET',
        response: { id: 'deploy_id', site_id: 'site_id', state: 'ready', summary: { messages: [] } },
      },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        )) as string

        const deploy = JSON.parse(output) as { site_id: string; deploy_id: string }
        expect(deploy.site_id).toBe('site_id')
        expect(deploy.deploy_id).toBe('deploy_id')

        const dropRequests = mockApi.requests.filter((r) => r.path.includes('/drop'))
        expect(dropRequests).toHaveLength(0)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should error when logged in with --allow-anonymous but no site linked', async (t) => {
    const routes: Route[] = [
      { path: 'sites/site_id', response: {} },
      { path: 'accounts', response: [{ slug: 'test-account' }] },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const rejected = callCli(
          ['deploy', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow(/No project linked/)
        await expect(rejected).rejects.toThrow(/--create-site/)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should show rate limit error with login hint when Drop API returns 429', async (t) => {
    const routes = createDropRoutes({ rateLimited: true })
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const rejected = callCli(
          ['deploy', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow(/daily limit/)
        await expect(rejected).rejects.toThrow(/netlify login/)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should block anonymous deploy when functions directory has files', async (t) => {
    const routes = createDropRoutes()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
          .withNetlifyToml({
            config: { build: { publish: 'public', functions: 'functions' } },
          })
          .withFunction({
            path: 'hello.js',
            handler: () => ({ statusCode: 200, body: 'Hello' }),
          })
        await builder.build()

        const rejected = callCli(
          ['deploy', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow(/require authentication/)
        await expect(rejected).rejects.toThrow(/netlify login/)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should block anonymous deploy when edge functions exist', async (t) => {
    const routes = createDropRoutes()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
          .withNetlifyToml({
            config: { build: { publish: 'public', edge_functions: 'netlify/edge-functions' } },
          })
          .withEdgeFunction({
            handler: () => new Response('Hello'),
            name: 'hello',
          })
        await builder.build()

        const rejected = callCli(
          ['deploy', '--no-build', '--dir', 'public', '--allow-anonymous'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '' },
          }),
        )

        await expect(rejected).rejects.toThrow(/require authentication/)
        await expect(rejected).rejects.toThrow(/netlify login/)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should suggest --allow-anonymous when not authenticated in non-interactive mode', async (t) => {
    const routes: Route[] = [
      { path: 'sites/site_id', response: {} },
      { path: 'accounts', response: [{ slug: 'test-account' }] },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const rejected = callCli(
          ['deploy', '--no-build', '--dir', 'public'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_AUTH_TOKEN: '', NETLIFY_SITE_ID: '', CI: 'true' },
          }),
        )

        await expect(rejected).rejects.toThrow(/--allow-anonymous/)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should claim site via --claim-site and --claim-token', async (t) => {
    const routes: Route[] = [
      ...createDropRoutes(),
      { path: 'sites/drop_site_id', response: { ...siteInfo, id: 'drop_site_id' } },
      { path: 'accounts/test-account/env', response: [] },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const output = (await callCli(
          ['deploy', '--claim-site', 'drop_site_id', '--claim-token', 'drop-jwt-token'],
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
      })
    } finally {
      await mockApi.close()
    }
  })
})
