const test = require('ava')

const callCli = require('./utils/call-cli')
const { withMockApi, getCLIOptions } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

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

test('env:list --json should return empty object if no vars set', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, {})
    })
  })
})

test('env:get --json should return empty object if var not set', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, {})
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
        ['env:import', '--replaceExisting', '--json', '.env'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, newBuildSettings.env)
    })
  })
})
