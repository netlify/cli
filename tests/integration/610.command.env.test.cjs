const process = require('process')

const test = require('ava')
const execa = require('execa')

const callCli = require('./utils/call-cli.cjs')
const cliPath = require('./utils/cli-path.cjs')
const { CONFIRM, answerWithValue, handleQuestions } = require('./utils/handle-questions.cjs')
const { getCLIOptions, withMockApi } = require('./utils/mock-api.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')
const { normalize } = require('./utils/snapshots.cjs')

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
}
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]

test('env:get --json should return empty object if var not set', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, {})
    })
  })
})

test('env:get --context should log an error message', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(['env:get', 'SOME_VAR', '--context', 'production'], getCLIOptions({ builder, apiUrl })),
      )

      t.true(cliResponse.includes(`opt in to the new environment variables experience`))
    })
  })
})

test('env:get --scope should log an error message', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(['env:get', 'SOME_VAR', '--scope', 'functions'], getCLIOptions({ builder, apiUrl })),
      )

      t.true(cliResponse.includes(`opt in to the new environment variables experience`))
    })
  })
})

test('env:set --json should create and return new var', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const newBuildSettings = { env: { SOME_VAR1: 'FOO' } }
    const createRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: {} } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'sites/site_id',
        method: 'PATCH',
        requestBody: {
          build_settings: newBuildSettings,
        },
        response: {
          ...siteInfo,
          build_settings: newBuildSettings,
        },
      },
    ]

    await withMockApi(createRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:set', '--json', 'SOME_VAR1', 'FOO'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})

test('env:set --json should update existing var', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const newBuildSettings = { env: { existing_env: 'new_value' } }
    const updateRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: { existing_env: 'old_value' } } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'sites/site_id',
        method: 'PATCH',
        requestBody: {
          build_settings: newBuildSettings,
        },
        response: {
          ...siteInfo,
          build_settings: newBuildSettings,
        },
      },
    ]

    await withMockApi(updateRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:set', '--json', 'existing_env', 'new_value'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})

test('env:get --json should return value of existing var', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const getRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: { existing_env: 'existing_value' } } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]

    await withMockApi(getRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:get', '--json', 'existing_env'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, { existing_env: 'existing_value' })
    })
  })
})

test('env:import should throw error if file not exists', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await t.throwsAsync(() => callCli(['env:import', '.env'], getCLIOptions({ builder, apiUrl })))
    })
  })
})

test('env:import --json should import new vars and override existing vars', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder
      .withEnvFile({
        path: '.env',
        env: {
          existing_env: 'new_value',
          new_env: 'new_value',
        },
      })
      .buildAsync()

    const newBuildSettings = { env: { existing_env: 'new_value', new_env: 'new_value' } }
    const importRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: { existing_env: 'existing_value' } } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'sites/site_id',
        method: 'PATCH',
        requestBody: {
          build_settings: newBuildSettings,
        },
        response: {
          ...siteInfo,
          build_settings: newBuildSettings,
        },
      },
    ]

    await withMockApi(importRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:import', '--json', '.env'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})

test('env:get --json should return value of var from netlify.toml', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: {
            environment: { from_toml_file: 'from_toml_file_value' },
          },
        },
      })
      .buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:get', '--json', 'from_toml_file'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, { from_toml_file: 'from_toml_file_value' })
    })
  })
})

test('env:list --json should return empty object if no vars set', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, {})
    })
  })
})

test('env:list --context should log an error message', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(['env:list', '--context', 'production'], getCLIOptions({ builder, apiUrl })),
      )

      t.true(cliResponse.includes(`opt in to the new environment variables experience`))
    })
  })
})

test('env:list --scope should log an error message', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(['env:list', '--scope', 'functions'], getCLIOptions({ builder, apiUrl })),
      )

      t.true(cliResponse.includes(`opt in to the new environment variables experience`))
    })
  })
})

test('env:list --json should return list of vars with netlify.toml taking priority', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: {
            environment: { existing_env: 'from_toml_file' },
          },
        },
      })
      .buildAsync()

    const getRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: { existing_env: 'from_ui' } } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]

    await withMockApi(getRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, { existing_env: 'from_toml_file' })
    })
  })
})

test('env:list should hide variables values and prompt to show', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const questions = [
      {
        question: 'Show values',
        answer: CONFIRM,
      },
    ]

    const envListRoutes = [
      {
        path: 'sites/site_id',
        response: { ...siteInfo, build_settings: { env: { DB_ADMIN: 'admin', DB_PASSWORD: '1234' } } },
      },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]

    await withMockApi(envListRoutes, async ({ apiUrl }) => {
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

      t.snapshot(normalize(cliResponse))
    })
  })
})

test('env:list should hide variables values and show on confirm', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const questions = [
      {
        question: 'Show values',
        answer: answerWithValue('y'),
      },
    ]

    const envListRoutes = [
      {
        path: 'sites/site_id',
        response: { ...siteInfo, build_settings: { env: { DB_ADMIN: 'admin', DB_PASSWORD: '1234' } } },
      },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]

    await withMockApi(envListRoutes, async ({ apiUrl }) => {
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

      t.snapshot(normalize(cliResponse))
    })
  })
})

test('env:list should not prompt on CI', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const envListRoutes = [
      {
        path: 'sites/site_id',
        response: { ...siteInfo, build_settings: { env: { DB_ADMIN: 'admin', DB_PASSWORD: '1234' } } },
      },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]

    await withMockApi(envListRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:list'], getCLIOptions({ builder, apiUrl, env: { CI: true } }))

      t.snapshot(normalize(cliResponse))
    })
  })
})

test('env:set --json should be able to set var with empty value', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const newBuildSettings = { env: { empty: '' } }
    const updateRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: {} } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'sites/site_id',
        method: 'PATCH',
        requestBody: {
          build_settings: newBuildSettings,
        },
        response: {
          ...siteInfo,
          build_settings: newBuildSettings,
        },
      },
    ]

    await withMockApi(updateRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:set', '--json', 'empty'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})

test('env:unset --json should remove existing variable', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const newBuildSettings = { env: {} }
    const updateRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: { to_delete: 'to_delete_value' } } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'sites/site_id',
        method: 'PATCH',
        requestBody: {
          build_settings: newBuildSettings,
        },
        response: {
          ...siteInfo,
          build_settings: newBuildSettings,
        },
      },
    ]

    await withMockApi(updateRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:unset', '--json', 'to_delete'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})

test('env:import --json --replace-existing should replace all existing vars and return imported', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder
      .withEnvFile({
        path: '.env',
        env: {
          new_env: 'new_value',
        },
      })
      .buildAsync()

    const newBuildSettings = { env: { new_env: 'new_value' } }
    const importRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: { existing_env: 'existing_value' } } } },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'sites/site_id',
        method: 'PATCH',
        requestBody: {
          build_settings: newBuildSettings,
        },
        response: {
          ...siteInfo,
          build_settings: newBuildSettings,
        },
      },
    ]

    await withMockApi(importRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:import', '--replace-existing', '--json', '.env'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})

test("env:clone should return without clone if there's no env in source site", async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()
    const createRoutes = [
      { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: {} } } },
      { path: 'sites/site_id_a', response: { ...siteInfo, build_settings: { env: {} } } },
    ]
    await withMockApi(createRoutes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:clone', '--to', 'site_id_a'], getCLIOptions({ builder, apiUrl }))

      t.snapshot(normalize(cliResponse))
    })
  })
})

test("env:clone should print error if --to site doesn't exist", async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()
    const createRoutes = [{ path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: {} } } }]
    await withMockApi(createRoutes, async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(['env:clone', '--to', 'to-site'], getCLIOptions({ builder, apiUrl })),
      )

      t.true(cliResponse.includes(`Can't find site with id to-site. Please make sure the site exists`))
    })
  })
})

test("env:clone should print error if --from site doesn't exist", async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()
    await withMockApi([], async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(['env:clone', '--from', 'from-site', '--to', 'to-site'], getCLIOptions({ builder, apiUrl })),
      )

      t.true(cliResponse.includes(`Can't find site with id from-site. Please make sure the site exists`))
    })
  })
})

test('env:clone should exit if the folder is not linked to a site, and --from is not provided', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const cliResponse = await callCli(['env:clone', '--to', 'site_id_a'], {
      cwd: builder.directory,
      extendEnv: false,
      PATH: process.env.PATH,
    })
    t.snapshot(normalize(cliResponse))
  })
})

test('env:clone should return success message', async (t) => {
  const envFrom = {
    clone_me: 'clone_me',
  }

  const envTo = {
    existing_env: 'existing_env',
  }

  const siteInfoTo = {
    ...siteInfo,
    id: 'site_id_a',
    name: 'site-name-a',
  }

  const newBuildSettings = {
    env: {
      ...envFrom,
      ...envTo,
    },
  }
  const expectedPatchRequest = {
    path: 'sites/site_id_a',
    method: 'PATCH',
    requestBody: {
      build_settings: newBuildSettings,
    },
    response: {
      ...siteInfoTo,
      build_settings: newBuildSettings,
    },
  }
  const cloneRoutes = [
    { path: 'sites/site_id', response: { ...siteInfo, build_settings: { env: envFrom } } },
    { path: 'sites/site_id_a', response: { ...siteInfoTo, build_settings: { env: envTo } } },
    { path: 'sites/site_id/service-instances', response: [] },
    {
      path: 'accounts',
      response: [{ slug: siteInfo.account_slug }],
    },
    expectedPatchRequest,
  ]

  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()
    await withMockApi(cloneRoutes, async ({ apiUrl, requests }) => {
      const cliResponse = await callCli(['env:clone', '--to', 'site_id_a'], getCLIOptions({ apiUrl, builder }))

      t.snapshot(normalize(cliResponse))

      const patchRequest = requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/sites/site_id_a',
      )
      t.deepEqual(patchRequest.body, expectedPatchRequest.requestBody)
    })
  })
})
