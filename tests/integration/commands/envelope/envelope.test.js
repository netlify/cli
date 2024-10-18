import { describe, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'
import { normalize } from '../../utils/snapshots.js'

const siteInfo = {
  account_slug: 'test-account',
  build_settings: {
    env: {},
  },
  id: 'site_id',
  name: 'site-name',
}
const existingVar = {
  key: 'EXISTING_VAR',
  scopes: ['builds', 'functions'],
  values: [
    {
      id: '1234',
      context: 'production',
      value: 'envelope-prod-value',
    },
    {
      id: '2345',
      context: 'dev',
      value: 'envelope-dev-value',
    },
  ],
}
const otherVar = {
  key: 'OTHER_VAR',
  scopes: ['builds', 'functions', 'runtime', 'post_processing'],
  values: [
    {
      id: '3456',
      context: 'all',
      value: 'envelope-all-value',
    },
  ],
}
const response = [existingVar, otherVar]
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    response: existingVar,
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    response: otherVar,
  },
  {
    path: 'accounts/test-account/env',
    response,
  },
  {
    path: 'accounts/test-account/env',
    method: 'POST',
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    method: 'PUT',
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    method: 'PATCH',
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    method: 'DELETE',
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR/value/1234',
    method: 'DELETE',
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    method: 'PATCH',
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    method: 'PUT',
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    method: 'DELETE',
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR/value/3456',
    method: 'DELETE',
    response: {},
  },
]

describe.concurrent('command/envelope', () => {
  test('env:import should throw error if file not exists', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        t.expect(callCli(['env:import', '.env'], getCLIOptions({ builder, apiUrl }))).rejects.toThrow()
      })
    })
  })

  test('env:import --json should import new vars and override existing vars', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const finalEnv = {
        EXISTING_VAR: 'from-dotenv',
        OTHER_VAR: 'envelope-all-value',
        NEW_VAR: 'from-dotenv',
      }

      await builder
        .withEnvFile({
          path: '.env',
          env: {
            EXISTING_VAR: 'from-dotenv',
            NEW_VAR: 'from-dotenv',
          },
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['env:import', '--json', '.env'], getCLIOptions({ builder, apiUrl }), true)

        t.expect(cliResponse).toStrictEqual(finalEnv)
      })
    })
  })

  test('env:import --json --replace-existing should replace all existing vars and return imported', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const finalEnv = {
        EXISTING_VAR: 'from-dotenv',
        NEW_VAR: 'from-dotenv',
      }

      await builder
        .withEnvFile({
          path: '.env',
          env: {
            EXISTING_VAR: 'from-dotenv',
            NEW_VAR: 'from-dotenv',
          },
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:import', '--replace-existing', '--json', '.env'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)
      })
    })
  })

  test('env:clone should return success message', async (t) => {
    const siteInfoFrom = {
      ...siteInfo,
      id: 'site_id_a',
      name: 'site-name-a',
    }

    const siteInfoTo = {
      ...siteInfo,
      id: 'site_id_b',
      name: 'site-name-b',
    }

    const cloneRoutes = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id_a', response: siteInfoFrom },
      { path: 'sites/site_id_b', response: siteInfoTo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'accounts/test-account/env',
        response,
      },
      {
        path: 'accounts/test-account/env',
        method: 'POST',
        response: {},
      },
      {
        path: 'accounts/test-account/env/EXISTING_VAR',
        method: 'DELETE',
        response: {},
      },
      {
        path: 'accounts/test-account/env/OTHER_VAR',
        method: 'DELETE',
        response: {},
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()
      await withMockApi(cloneRoutes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:clone', '--from', 'site_id_a', '--to', 'site_id_b', '--force'],
          getCLIOptions({ apiUrl, builder }),
        )

        t.expect(normalize(cliResponse)).toMatchSnapshot()

        const deleteRequests = requests.filter((request) => request.method === 'DELETE')
        t.expect(deleteRequests.length).toBe(2)

        const postRequest = requests.find((request) => request.method === 'POST')
        t.expect(postRequest.body.map(({ key }) => key)).toStrictEqual(['EXISTING_VAR', 'OTHER_VAR'])
      })
    })
  })
})
