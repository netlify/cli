import process from 'process'

import execa from 'execa'
import { describe, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { cliPath } from '../../utils/cli-path.js'
import { CONFIRM, answerWithValue, handleQuestions } from '../../utils/handle-questions.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'
import { normalize } from '../../utils/snapshots.js'

const siteInfo = {
  account_slug: 'test-account',
  build_settings: { env: {} },
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
      value: 'prod-value',
    },
    {
      id: '2345',
      context: 'dev',
      value: 'dev-value',
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
      value: 'all-value',
    },
  ],
}
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
]

describe('commands/env', () => {
  describe('env:get', () => {
    test('--json should return empty object if var not set', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR'], getCLIOptions({ builder, apiUrl }), true)

          t.expect(cliResponse).toStrictEqual({})
        })
      })
    })

    test('--json should return value of existing var', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const getRoutes = [...routes, { path: 'accounts/test-account/env/EXISTING_VAR', response: existingVar }]

        await withMockApi(getRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:get', '--json', 'EXISTING_VAR'],
            getCLIOptions({ builder, apiUrl }),
            true,
          )

          t.expect(cliResponse).toStrictEqual({ EXISTING_VAR: 'dev-value' })
        })
      })
    })

    test('--json should return value of var from netlify.toml', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder
          .withNetlifyToml({
            config: {
              build: {
                environment: { FROM_TOML: 'FROM_TOML' },
              },
            },
          })
          .build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:get', '--json', 'FROM_TOML'],
            getCLIOptions({ builder, apiUrl }),
            true,
          )

          t.expect(cliResponse).toStrictEqual({ FROM_TOML: 'FROM_TOML' })
        })
      })
    })
  })

  describe('env:list', () => {
    test('--json should return empty object if no vars set', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const listRoutes = [...routes, { path: 'accounts/test-account/env', response: [] }]

        await withMockApi(listRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

          t.expect(cliResponse).toStrictEqual({})
        })
      })
    })

    test('--json should return list of vars with netlify.toml taking priority', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder
          .withNetlifyToml({
            config: {
              build: {
                environment: { EXISTING_VAR: 'TOML_VALUE' },
              },
            },
          })
          .build()

        const listRoutes = [...routes, { path: 'accounts/test-account/env', response: [existingVar, otherVar] }]

        await withMockApi(listRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

          t.expect(cliResponse).toStrictEqual({
            EXISTING_VAR: 'TOML_VALUE',
            OTHER_VAR: 'all-value',
          })
        })
      })
    })

    test('should hide variables values and prompt to show', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const questions = [
          {
            question: 'Show values',
            answer: CONFIRM,
          },
        ]

        const listRoutes = [...routes, { path: 'accounts/test-account/env', response: [existingVar, otherVar] }]

        await withMockApi(listRoutes, async ({ apiUrl }) => {
          // we set extendEnv: false to prevent the CLI detecting GitHub Actions as CI
          const childProcess = execa(
            cliPath,
            ['env:list'],
            getCLIOptions({
              apiUrl,
              builder,
              extendEnv: false,
              env: { PATH: process.env.PATH, HOME: process.env.HOME, APPDATA: process.env.APPDATA },
            }),
          )

          handleQuestions(childProcess, questions)

          const { stdout: cliResponse } = await childProcess

          t.expect(normalize(cliResponse)).toMatchSnapshot()
        })
      })
    })

    test('should hide variables values and show on confirm', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const questions = [
          {
            question: 'Show values',
            answer: answerWithValue('y'),
          },
        ]

        const listRoutes = [...routes, { path: 'accounts/test-account/env', response: [existingVar, otherVar] }]

        await withMockApi(listRoutes, async ({ apiUrl }) => {
          // we set extendEnv: false to prevent the CLI detecting GitHub Actions as CI
          const childProcess = execa(
            cliPath,
            ['env:list'],
            getCLIOptions({
              apiUrl,
              builder,
              extendEnv: false,
              env: { PATH: process.env.PATH, HOME: process.env.HOME, APPDATA: process.env.APPDATA },
            }),
          )

          handleQuestions(childProcess, questions)

          const { stdout: cliResponse } = await childProcess

          t.expect(normalize(cliResponse)).toMatchSnapshot()
        })
      })
    })

    test('should not prompt on CI', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const listRoutes = [...routes, { path: 'accounts/test-account/env', response: [existingVar, otherVar] }]

        await withMockApi(listRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(['env:list'], getCLIOptions({ builder, apiUrl, env: { CI: true } }))

          t.expect(normalize(cliResponse)).toMatchSnapshot()
        })
      })
    })
  })

  describe('env:set', () => {
    test('--json should create and return new var', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const setRoutes = [
          ...routes,
          { path: 'accounts/test-account/env', response: [existingVar, otherVar] },
          { path: 'accounts/test-account/env', method: 'POST', response: {} },
        ]

        await withMockApi(setRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:set', '--json', 'NEW_VAR', 'new-value', '--force'],
            getCLIOptions({ builder, apiUrl }),
            true,
          )

          t.expect(cliResponse).toStrictEqual({
            EXISTING_VAR: 'dev-value',
            OTHER_VAR: 'all-value',
            NEW_VAR: 'new-value',
          })
        })
      })
    })

    test('--json should update existing var', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const setRoutes = [
          ...routes,
          { path: 'accounts/test-account/env', response: [existingVar, otherVar] },
          { path: 'accounts/test-account/env/EXISTING_VAR', method: 'PUT', response: {} },
        ]

        await withMockApi(setRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:set', '--json', 'EXISTING_VAR', 'new-value', '--force'],
            getCLIOptions({ builder, apiUrl }),
            true,
          )

          t.expect(cliResponse).toStrictEqual({
            EXISTING_VAR: 'new-value',
            OTHER_VAR: 'all-value',
          })
        })
      })
    })
  })

  describe('env:unset', () => {
    test('--json should remove existing variable', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const unsetRoutes = [
          ...routes,
          { path: 'accounts/test-account/env', response: [existingVar, otherVar] },
          { path: 'accounts/test-account/env/EXISTING_VAR', method: 'DELETE', response: {} },
        ]

        await withMockApi(unsetRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:unset', '--json', 'EXISTING_VAR', '--force'],
            getCLIOptions({ builder, apiUrl }),
            true,
          )

          t.expect(cliResponse).toStrictEqual({
            OTHER_VAR: 'all-value',
          })
        })
      })
    })
  })

  describe('env:import', () => {
    test('env:import should throw error if file not exists', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          await t.expect(() => callCli(['env:import', '.env'], getCLIOptions({ builder, apiUrl }))).rejects.toThrow()
        })
      })
    })

    test('--json should import new vars and override existing vars', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder
          .withEnvFile({
            path: '.env',
            env: {
              EXISTING_VAR: 'new-value',
              NEW_VAR: 'new-value',
            },
          })
          .build()

        const importRoutes = [
          ...routes,
          { path: 'accounts/test-account/env', response: [existingVar] },
          { path: 'accounts/test-account/env', method: 'POST', response: {} },
          { path: 'accounts/test-account/env/EXISTING_VAR', method: 'DELETE', response: {} },
        ]

        await withMockApi(importRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(['env:import', '--json', '.env'], getCLIOptions({ builder, apiUrl }), true)

          t.expect(cliResponse).toStrictEqual({
            EXISTING_VAR: 'new-value',
            NEW_VAR: 'new-value',
          })
        })
      })
    })

    test('--json --replace-existing should replace all existing vars and return imported', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder
          .withEnvFile({
            path: '.env',
            env: {
              NEW_VAR: 'new-value',
            },
          })
          .build()

        const importRoutes = [
          ...routes,
          { path: 'accounts/test-account/env', response: [existingVar] },
          { path: 'accounts/test-account/env', method: 'POST', response: [] },
          { path: 'accounts/test-account/env/EXISTING_VAR', method: 'DELETE', response: {} },
        ]

        await withMockApi(importRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:import', '--replace-existing', '--json', '.env'],
            getCLIOptions({ builder, apiUrl }),
            true,
          )

          t.expect(cliResponse).toStrictEqual({
            NEW_VAR: 'new-value',
          })
        })
      })
    })
  })

  describe('env:clone', () => {
    test("should return without clone if there's no env in source site", async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        const createRoutes = [
          { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
          { path: 'accounts/test-account/env', response: [] },
          { path: 'sites/site_id/service-instances', response: [] },
          { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: {} } } },
          { path: 'sites/site_id_a', response: { ...siteInfo, build_settings: { env: {} } } },
        ]
        await withMockApi(createRoutes, async ({ apiUrl }) => {
          const cliResponse = await callCli(
            ['env:clone', '--to', 'site_id_a', '--force'],
            getCLIOptions({ builder, apiUrl }),
          )

          t.expect(normalize(cliResponse)).toMatchSnapshot()
        })
      })
    })

    test("should print error if --to site doesn't exist", async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        const createRoutes = [{ path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: {} } } }]
        await withMockApi(createRoutes, async ({ apiUrl }) => {
          const { stderr: cliResponse } = await callCli(
            ['env:clone', '--to', 'to-site', '--force'],
            getCLIOptions({ builder, apiUrl }),
          ).catch((error) => error)

          t.expect(cliResponse.includes(`Can't find site with id to-site. Please make sure the site exists`)).toBe(true)
        })
      })
    })

    test("should print error if --from site doesn't exist", async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        await withMockApi([], async ({ apiUrl }) => {
          const { stderr: cliResponse } = await callCli(
            ['env:clone', '--from', 'from-site', '--to', 'to-site', '--force'],
            getCLIOptions({ builder, apiUrl }),
          ).catch((error) => error)

          t.expect(cliResponse.includes(`Can't find site with id from-site. Please make sure the site exists`)).toBe(
            true,
          )
        })
      })
    })

    test('should exit if the folder is not linked to a site, and --from is not provided', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        const cliResponse = await callCli(['env:clone', '--to', 'site_id_a', '--force'], {
          cwd: builder.directory,
          extendEnv: false,
          PATH: process.env.PATH,
        })

        t.expect(normalize(cliResponse)).toMatchSnapshot()
      })
    })

    test('should return success message', async (t) => {
      const cloneRoutes = [
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'sites/site_id/service-instances', response: [] },
        { path: 'sites/site_id', response: siteInfo },
        {
          path: 'sites/site_id_a',
          response: {
            id: 'site_id_a',
            name: 'site-name-a',
            account_slug: 'test-account-a',
            build_settings: { env: {} },
          },
        },
        { path: 'accounts/test-account/env', response: [existingVar] },
        { path: 'accounts/test-account-a/env', response: [otherVar] },
        { path: 'accounts/test-account-a/env', method: 'POST', response: {} },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        await withMockApi(cloneRoutes, async ({ apiUrl, requests }) => {
          const cliResponse = await callCli(
            ['env:clone', '--to', 'site_id_a', '--force'],
            getCLIOptions({ apiUrl, builder }),
          )

          t.expect(normalize(cliResponse)).toMatchSnapshot()

          const postRequest = requests.find((request) => request.method === 'POST')
          t.expect(postRequest.body).toStrictEqual([existingVar])
        })
      })
    })
  })
})
