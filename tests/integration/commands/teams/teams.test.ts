import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions } from '../../utils/mock-api-vitest.js'
import { startDeployMockApi } from '../deploy/deploy-api-routes.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const multipleTeamsRoutes = [
  {
    path: 'accounts',
    response: [
      {
        id: 'account-1',
        slug: 'team-alpha',
        name: 'Team Alpha',
        default: true,
        type_name: 'Starter',
        type_slug: 'starter',
        members_count: 3,
      },
      {
        id: 'account-2',
        slug: 'team-beta',
        name: 'Team Beta',
        default: false,
        type_name: 'Pro',
        type_slug: 'pro',
        members_count: 7,
      },
    ],
  },
  { path: 'sites/site_id', response: { id: 'site_id', name: 'test-site' } },
]

const singleTeamRoutes = [
  {
    path: 'accounts',
    response: [
      {
        id: 'account-1',
        slug: 'only-team',
        name: 'Only Team',
        default: true,
        type_name: 'Starter',
        type_slug: 'starter',
        members_count: 1,
      },
    ],
  },
  { path: 'sites/site_id', response: { id: 'site_id', name: 'test-site' } },
]

describe('teams:list command', () => {
  test('should output JSON with --json flag for multiple teams', async (t) => {
    const mockApi = await startDeployMockApi({ routes: multipleTeamsRoutes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const output = (await callCli(
          ['teams:list', '--json'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        )) as string

        const teams = JSON.parse(output) as { slug: string; name: string }[]
        expect(teams).toHaveLength(2)
        expect(teams[0]).toMatchObject({ slug: 'team-alpha', name: 'Team Alpha' })
        expect(teams[1]).toMatchObject({ slug: 'team-beta', name: 'Team Beta' })
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should output JSON with --json flag for single team', async (t) => {
    const mockApi = await startDeployMockApi({ routes: singleTeamRoutes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const output = (await callCli(
          ['teams:list', '--json'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        )) as string

        const teams = JSON.parse(output) as { slug: string; name: string; members_count: number }[]
        expect(teams).toHaveLength(1)
        expect(teams[0]).toMatchObject({ slug: 'only-team', name: 'Only Team', members_count: 1 })
      })
    } finally {
      await mockApi.close()
    }
  })

  test('should display human-readable output without --json', async (t) => {
    const mockApi = await startDeployMockApi({ routes: multipleTeamsRoutes })
    try {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const output = (await callCli(['teams:list'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder }))) as string

        expect(output).toContain('Team Alpha')
        expect(output).toContain('Team Beta')
        expect(output).toContain('team-alpha')
        expect(output).toContain('team-beta')
      })
    } finally {
      await mockApi.close()
    }
  })
})
