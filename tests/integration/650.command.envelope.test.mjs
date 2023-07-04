import { describe, test } from 'vitest'

import callCli from './utils/call-cli.cjs'
import { getCLIOptions, withMockApi } from './utils/mock-api.cjs'
import { withSiteBuilder } from './utils/site-builder.cjs'
import { normalize } from './utils/snapshots.cjs'

const siteInfo = {
  account_slug: 'test-account',
  build_settings: {
    env: {},
  },
  id: 'site_id',
  name: 'site-name',
  use_envelope: true,
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
const envelopeResponse = [existingVar, otherVar]
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
    response: envelopeResponse,
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

describe.concurrent('envelope', () => {
  test('env:get --json should return empty object if var not set', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR'], getCLIOptions({ builder, apiUrl }), true)

        t.expect(cliResponse).toEqual({})
      })
    })
  })

  test('env:get --context should return the value for the given context when present', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:get', '--json', 'EXISTING_VAR', '--context', 'production'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse.EXISTING_VAR).toEqual('envelope-prod-value')
      })
    })
  })

  test('env:get --context should not return the value for the given context when not present', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:get', '--json', 'EXISTING_VAR', '--context', 'deploy-preview'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse.EXISTING_VAR).toBeUndefined()
      })
    })
  })

  test('env:get --scope should find the value for the given scope when present', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:get', '--json', 'EXISTING_VAR', '--scope', 'functions'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse.EXISTING_VAR).toEqual('envelope-dev-value')
      })
    })
  })

  test('env:get --scope should not find the value for the given scope when not present', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:get', '--json', 'EXISTING_VAR', '--scope', 'runtime'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse.EXISTING_VAR).toBeUndefined()
      })
    })
  })

  test('env:list --json should return the object of keys and values', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

        t.expect(cliResponse).toStrictEqual(finalEnv)
      })
    })
  })

  test('env:list --context should return the keys and values for the given context', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-prod-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:list', '--context', 'production', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)
      })
    })
  })

  test('env:list --scope should return the keys and values for the given scope', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['env:list', '--scope', 'runtime', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)
      })
    })
  })

  test('env:set --context=dev should create and return new var in the dev context', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
        NEW_VAR: 'new-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'NEW_VAR', 'new-value', '--context', 'dev', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const postRequest = requests.find(
          (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
        )

        t.expect(postRequest.body[0].key).toEqual('NEW_VAR')
        t.expect(postRequest.body[0].values[0].context).toEqual('dev')
        t.expect(postRequest.body[0].values[0].value).toEqual('new-value')
      })
    })
  })

  test('env:set --context=dev should update an existing var in the dev context', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-new-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'EXISTING_VAR', 'envelope-new-value', '--context', 'dev', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const patchRequest = requests.find(
          (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
        )

        t.expect(patchRequest.body.context).toEqual('dev')
        t.expect(patchRequest.body.value).toEqual('envelope-new-value')
      })
    })
  })

  test('env:set --context should support variadic options', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'multiple',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'EXISTING_VAR', 'multiple', '--context', 'deploy-preview', 'production', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const patchRequests = requests.filter(
          (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
        )

        t.expect(patchRequests.length).toBe(2)

        // The order of the request might not be always the same, so we need to find the request
        const dpRequest = patchRequests.find((request) => request.body.context === 'deploy-preview')
        t.expect(dpRequest).not.toBeUndefined()
        t.expect(dpRequest.body.value).toEqual('multiple')

        const prodRequest = patchRequests.find((request) => request.body.context === 'production')
        t.expect(prodRequest).not.toBeUndefined()
        t.expect(prodRequest.body.value).toEqual('multiple')
      })
    })
  })

  test('env:set without flags should update existing var', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'new-envelope-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', '--json', 'EXISTING_VAR', 'new-envelope-value'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const putRequest = requests.find(
          (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
        )

        t.expect(putRequest.body.key).toEqual('EXISTING_VAR')
        t.expect(putRequest.body.values[0].context).toEqual('all')
        t.expect(putRequest.body.values[0].value).toEqual('new-envelope-value')
      })
    })
  })

  test('env:set --scope should set the scope of an existing env var without needing a value', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'EXISTING_VAR', '--scope', 'runtime', 'post-processing', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const putRequest = requests.find(
          (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
        )

        t.expect(putRequest.body.values[0].context).toEqual('production')
        t.expect(putRequest.body.values[1].context).toEqual('dev')
        t.expect(putRequest.body.scopes[0]).toEqual('runtime')
        t.expect(putRequest.body.scopes[1]).toEqual('post-processing')
      })
    })
  })

  test('env:set --secret --context production deploy-preview branch-deploy should create new secret values', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        TOTALLY_NEW_SECRET: 'shhhhhhecret',
        EXISTING_VAR: 'envelope-prod-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          [
            'env:set',
            'TOTALLY_NEW_SECRET',
            'shhhhhhecret',
            '--secret',
            '--context',
            'production',
            'deploy-preview',
            'branch-deploy',
            '--json',
          ],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const postRequest = requests.find(
          (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
        )

        t.expect(postRequest.body.length).toBe(1)
        t.expect(postRequest.body[0].key).toEqual('TOTALLY_NEW_SECRET')
        t.expect(postRequest.body[0].is_secret).toBe(true)
        t.expect(postRequest.body[0].values[0].context).toEqual('production')
        t.expect(postRequest.body[0].values[0].value).toEqual('shhhhhhecret')
        t.expect(postRequest.body[0].values.length).toBe(3)
      })
    })
  })

  test('env:set --secret --context production should update a single value', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-new-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'EXISTING_VAR', 'envelope-new-value', '--secret', '--context', 'production', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const patchRequest = requests.find(
          (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
        )

        t.expect(patchRequest.body.context).toEqual('production')
        t.expect(patchRequest.body.value).toEqual('envelope-new-value')
      })
    })
  })

  test('env:set --secret should convert an `all` env var to a secret when no value is passed', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'OTHER_VAR', '--secret', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const putRequest = requests.find(
          (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/OTHER_VAR',
        )

        t.expect(putRequest.body.is_secret, true)
        t.expect(putRequest.body.values.length).toBe(4)
        t.expect(putRequest.body.values[0].context).toEqual('production')
        t.expect(putRequest.body.values[0].value).toEqual('envelope-all-value')
        t.expect(putRequest.body.values[1].context).toEqual('deploy-preview')
        t.expect(putRequest.body.values[2].context).toEqual('branch-deploy')
        t.expect(putRequest.body.values[3].context).toEqual('dev')
        t.expect(putRequest.body.values[3].value).toEqual('')
        t.expect(putRequest.body.scopes.length).toBe(3)
        t.expect(putRequest.body.scopes[0]).toEqual('builds')
        t.expect(putRequest.body.scopes[1]).toEqual('functions')
        t.expect(putRequest.body.scopes[2]).toEqual('runtime')
      })
    })
  })

  test('env:set --secret should convert an env var with many values to a secret when no value is passed', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:set', 'EXISTING_VAR', '--secret', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const putRequest = requests.find(
          (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
        )

        t.expect(putRequest.body.is_secret).toBe(true)
        t.expect(putRequest.body.values.length).toBe(2)
        t.expect(putRequest.body.values[0].context).toEqual('production')
        t.expect(putRequest.body.values[0].value).toEqual('envelope-prod-value')
        t.expect(putRequest.body.values[1].context).toEqual('dev')
        t.expect(putRequest.body.values[1].value).toEqual('envelope-dev-value')
        t.expect(putRequest.body.scopes.length).toBe(2)
        t.expect(putRequest.body.scopes[0]).toEqual('builds')
        t.expect(putRequest.body.scopes[1]).toEqual('functions')
      })
    })
  })

  test('env:set --secret should error when a value is passed without --context', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const { stderr: cliResponse } = await callCli(
          ['env:set', 'TOTALLY_NEW', 'cool-value', '--secret'],
          getCLIOptions({ builder, apiUrl }),
        ).catch((error) => error)

        t.expect(cliResponse.includes(`please specify a non-development context`)).toBe(true)
      })
    })
  })

  test('env:set --secret should error when set with a post-processing --scope', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const { stderr: cliResponse } = await callCli(
          ['env:set', 'TOTALLY_NEW', 'cool-value', '--secret', '--scope', 'builds', 'post-processing'],
          getCLIOptions({ builder, apiUrl }),
        ).catch((error) => error)

        t.expect(cliResponse.includes(`Secret values cannot be used within the post-processing scope.`)).toBe(true)
      })
    })
  })

  test('env:set should error when --scope and --context are passed on an existing env var', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const { stderr: cliResponse } = await callCli(
          ['env:set', 'EXISTING_VAR', '--scope', 'functions', '--context', 'production'],
          getCLIOptions({ builder, apiUrl }),
        ).catch((error) => error)

        t.expect(
          cliResponse.includes(`Setting the context and scope at the same time on an existing env var is not allowed`),
        ).toBe(true)
      })
    })
  })

  test('env:import should throw error if file not exists', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        t.expect(callCli(['env:import', '.env'], getCLIOptions({ builder, apiUrl }))).rejects.toThrow()
      })
    })
  })

  test('env:import --json should import new vars and override existing vars', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
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
        .buildAsync()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['env:import', '--json', '.env'], getCLIOptions({ builder, apiUrl }), true)

        t.expect(cliResponse).toStrictEqual(finalEnv)
      })
    })
  })

  test('env:unset --json should remove existing variable', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:unset', '--json', 'EXISTING_VAR'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const deleteRequest = requests.find((request) => request.method === 'DELETE')
        t.expect(deleteRequest.path).toEqual('/api/v1/accounts/test-account/env/EXISTING_VAR')
      })
    })
  })

  test('env:unset --context should remove existing variable value', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {
        OTHER_VAR: 'envelope-all-value',
      }

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:unset', 'EXISTING_VAR', '--context', 'production', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const deleteRequest = requests.find((request) => request.method === 'DELETE')
        t.expect(deleteRequest.path).toEqual('/api/v1/accounts/test-account/env/EXISTING_VAR/value/1234')
      })
    })
  })

  test('env:unset --context should split up an `all` value', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()

      const finalEnv = {}

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:unset', 'OTHER_VAR', '--context', 'branch-deploy', '--json'],
          getCLIOptions({ builder, apiUrl }),
          true,
        )

        t.expect(cliResponse).toStrictEqual(finalEnv)

        const deleteRequest = requests.find((request) => request.method === 'DELETE')
        t.expect(deleteRequest.path).toEqual('/api/v1/accounts/test-account/env/OTHER_VAR/value/3456')

        const patchRequests = requests.filter(
          (request) => request.method === 'PATCH' && '/api/v1/accounts/test-account/env/OTHER_VAR',
        )

        t.expect(patchRequests.length).toBe(3)
      })
    })
  })

  test('env:import --json --replace-existing should replace all existing vars and return imported', async (t) => {
    await withSiteBuilder('site-env', async (builder) => {
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
        .buildAsync()

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

  test('env:clone should return success message (mongo to envelope)', async (t) => {
    const envFrom = {
      CLONE_ME: 'clone_me',
      EXISTING_VAR: 'from',
    }

    const siteInfoFrom = {
      ...siteInfo,
      id: 'site_id_a',
      name: 'site-name-a',
      build_settings: { env: envFrom },
      use_envelope: false,
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
        response: envelopeResponse,
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
    ]

    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()
      await withMockApi(cloneRoutes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:clone', '--from', 'site_id_a', '--to', 'site_id_b'],
          getCLIOptions({ apiUrl, builder }),
        )

        t.expect(normalize(cliResponse)).toMatchSnapshot()

        const deleteRequest = requests.find((request) => request.method === 'DELETE')
        t.expect(deleteRequest.path).toEqual('/api/v1/accounts/test-account/env/EXISTING_VAR')

        const postRequest = requests.find(
          (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
        )

        t.expect(postRequest.body.length).toBe(2)
        t.expect(postRequest.body[0].key).toEqual('CLONE_ME')
        t.expect(postRequest.body[0].values[0].value).toEqual('clone_me')
        t.expect(postRequest.body[1].key).toEqual('EXISTING_VAR')
        t.expect(postRequest.body[1].values[0].value).toEqual('from')
      })
    })
  })

  test('env:clone should return success message (envelope to mongo)', async (t) => {
    const siteInfoFrom = {
      ...siteInfo,
      id: 'site_id_a',
      name: 'site-name-a',
    }

    const envTo = {
      CLONE_ME: 'clone_me',
      EXISTING_VAR: 'to',
    }

    const siteInfoTo = {
      ...siteInfo,
      id: 'site_id_b',
      name: 'site-name-b',
      build_settings: { env: envTo },
      use_envelope: false,
    }

    const finalEnv = {
      ...envTo,
      EXISTING_VAR: 'envelope-dev-value',
      OTHER_VAR: 'envelope-all-value',
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
        response: envelopeResponse,
      },
      {
        path: 'sites/site_id_b',
        method: 'PATCH',
        response: {},
      },
    ]

    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()
      await withMockApi(cloneRoutes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:clone', '--from', 'site_id_a', '--to', 'site_id_b'],
          getCLIOptions({ apiUrl, builder }),
        )

        t.expect(normalize(cliResponse)).toMatchSnapshot()

        const patchRequest = requests.find(
          (request) => request.method === 'PATCH' && request.path === '/api/v1/sites/site_id_b',
        )

        t.expect(patchRequest.body).toStrictEqual({ build_settings: { env: finalEnv } })
      })
    })
  })

  test('env:clone should return success message (envelope to envelope)', async (t) => {
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
        response: envelopeResponse,
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

    await withSiteBuilder('site-env', async (builder) => {
      await builder.buildAsync()
      await withMockApi(cloneRoutes, async ({ apiUrl, requests }) => {
        const cliResponse = await callCli(
          ['env:clone', '--from', 'site_id_a', '--to', 'site_id_b'],
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
