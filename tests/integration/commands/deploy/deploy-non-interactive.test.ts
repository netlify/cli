import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions } from '../../utils/mock-api-vitest.js'
import { startDeployMockApi } from './deploy-api-routes.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import type { Route } from '../../utils/mock-api-vitest.js'
import type express from 'express'

interface DeployOutput {
  site_id: string
  deploy_id: string
}

const siteInfo = {
  id: 'site_id',
  name: 'test-site',
  account_slug: 'test-account',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
  build_settings: { repo_url: '' },
}

const deployResponse = {
  id: 'deploy_id',
  site_id: 'site_id',
  name: 'test-site',
  deploy_ssl_url: 'https://deploy-id--test-site.netlify.app',
  deploy_url: 'https://deploy-id--test-site.netlify.app',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
}

const createRoutesForSiteCreation = (options?: { failFirstCreate?: boolean }): Route[] => {
  let createAttempts = 0

  return [
    { path: 'sites', method: 'GET', response: [] },
    { path: 'accounts', response: [{ slug: 'test-account', name: 'Test Account', default: true }] },
    { path: 'accounts/test-account/env', response: [] },
    {
      path: 'test-account/sites',
      method: 'POST',
      response: (req: express.Request, res: express.Response) => {
        createAttempts++
        if (options?.failFirstCreate && createAttempts === 1) {
          res.status(422)
          res.json({ message: 'Name already taken' })
          return
        }
        const body = req.body as { name?: string }
        const name = body.name || 'random-generated-name'
        res.json({
          ...siteInfo,
          name,
          ssl_url: `https://${name}.netlify.app`,
        })
      },
    },
    { path: 'sites/site_id', response: siteInfo },
    {
      path: 'sites/site_id/deploys',
      method: 'POST',
      response: { ...deployResponse, state: 'prepared', required: [], required_functions: [] },
    },
    {
      path: 'sites/site_id/deploys/deploy_id',
      method: 'PUT',
      response: { ...deployResponse, state: 'prepared', required: [], required_functions: [] },
    },
    {
      path: 'sites/site_id/deploys/deploy_id',
      method: 'GET',
      response: { ...deployResponse, state: 'ready' },
    },
    { path: 'deploys/deploy_id/lock', method: 'POST', response: {} },
    { path: 'deploys/deploy_id/unlock', method: 'POST', response: {} },
    { path: 'deploys/deploy_id/cancel', method: 'POST', response: {} },
    {
      path: 'deploys/deploy_id',
      method: 'GET',
      response: { ...deployResponse, state: 'ready', summary: { messages: [] } },
    },
  ]
}

const parseDeploy = (output: string): DeployOutput => JSON.parse(output) as DeployOutput

describe('deploy non-interactive mode', () => {
  test('--site-name should create a site and deploy', async (t) => {
    const routes = createRoutesForSiteCreation()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          [
            'deploy',
            '--json',
            '--no-build',
            '--dir',
            'public',
            '--site-name',
            'my-test-site',
            '--team',
            'test-account',
          ],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
        )) as string

        const deploy = parseDeploy(output)
        expect(deploy.site_id).toBe('site_id')
        expect(deploy.deploy_id).toBe('deploy_id')

        const siteCreateRequests = mockApi.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/sites'))
        expect(siteCreateRequests).toHaveLength(1)
        const createBody = siteCreateRequests[0].body as { name?: string }
        expect(createBody.name).toBe('my-test-site')
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should auto-resolve name collision with suffix', async (t) => {
    const routes = createRoutesForSiteCreation({ failFirstCreate: true })
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--site-name', 'taken-name', '--team', 'test-account'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
        )) as string

        const deploy = parseDeploy(output)
        expect(deploy.site_id).toBe('site_id')

        const siteCreateRequests = mockApi.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/sites'))
        expect(siteCreateRequests).toHaveLength(2)
        const secondBody = siteCreateRequests[1].body as { name?: string }
        expect(secondBody.name).toMatch(/^taken-name-[0-9a-f]{8}$/)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should fail fast with helpful error when non-interactive and multiple teams with no default', async (t) => {
    const routes: Route[] = [
      { path: 'sites', method: 'GET', response: [] },
      {
        path: 'accounts',
        response: [
          { slug: 'team-a', name: 'Team A', default: false },
          { slug: 'team-b', name: 'Team B', default: false },
        ],
      },
      { path: 'sites/site_id', response: {} },
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
            env: { NETLIFY_SITE_ID: '', CI: 'true' },
          }),
        )
        await expect(rejected).rejects.toThrow(/--team/)
        await expect(rejected).rejects.toThrow(/team-a/)
        await expect(rejected).rejects.toThrow(/team-b/)
        await expect(rejected).rejects.toThrow(/teams:list/)

        const siteCreateRequests = mockApi.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/sites'))
        expect(siteCreateRequests).toHaveLength(0)
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should auto-create site when non-interactive with single team', async (t) => {
    const routes = createRoutesForSiteCreation()
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '', CI: 'true' },
          }),
        )) as string

        const deploy = parseDeploy(output)
        expect(deploy.site_id).toBe('site_id')
        expect(deploy.deploy_id).toBe('deploy_id')
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should auto-create site when non-interactive with default team among multiple', async (t) => {
    const routes: Route[] = [
      { path: 'sites', method: 'GET', response: [] },
      {
        path: 'accounts',
        response: [
          { slug: 'team-a', name: 'Team A', default: false },
          { slug: 'default-team', name: 'Default Team', default: true },
        ],
      },
      { path: 'accounts/default-team/env', response: [] },
      {
        path: 'default-team/sites',
        method: 'POST',
        response: siteInfo,
      },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites/site_id/deploys',
        method: 'POST',
        response: { ...deployResponse, state: 'prepared', required: [], required_functions: [] },
      },
      {
        path: 'sites/site_id/deploys/deploy_id',
        method: 'PUT',
        response: { ...deployResponse, state: 'prepared', required: [], required_functions: [] },
      },
      {
        path: 'sites/site_id/deploys/deploy_id',
        method: 'GET',
        response: { ...deployResponse, state: 'ready' },
      },
      { path: 'deploys/deploy_id/lock', method: 'POST', response: {} },
      { path: 'deploys/deploy_id/unlock', method: 'POST', response: {} },
      { path: 'deploys/deploy_id/cancel', method: 'POST', response: {} },
      {
        path: 'deploys/deploy_id',
        method: 'GET',
        response: { ...deployResponse, state: 'ready', summary: { messages: [] } },
      },
    ]
    const mockApi = await startDeployMockApi({ routes })
    try {
      await withSiteBuilder(t, async (builder) => {
        builder.withContentFile({ path: 'public/index.html', content: '<h1>Hello</h1>' })
        await builder.build()

        const output = (await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public'],
          getCLIOptions({
            apiUrl: mockApi.apiUrl,
            builder,
            env: { NETLIFY_SITE_ID: '', CI: 'true' },
          }),
        )) as string

        const deploy = parseDeploy(output)
        expect(deploy.site_id).toBe('site_id')
      })
    } finally {
      await mockApi.close()
    }
  })
})
