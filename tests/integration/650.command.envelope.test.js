const test = require('ava')

const callCli = require('./utils/call-cli')
const { getCLIOptions, withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')
const { normalize } = require('./utils/snapshots')

const siteInfo = {
  account_slug: 'test-account',
  build_settings: {
    env: {},
  },
  id: 'site_id',
  name: 'site-name',
  use_envelope: true,
}
const envelopeResponse = [
  {
    key: 'EXISTING_VAR',
    scopes: ['builds', 'functions', 'runtime', 'post_processing'],
    values: [
      {
        context: 'all',
        value: 'envelope-value',
      },
    ],
  },
  {
    key: 'OTHER_VAR',
    scopes: ['builds', 'functions', 'runtime', 'post_processing'],
    values: [
      {
        context: 'all',
        value: 'envelope-value',
      },
    ],
  },
]
const routes = [
  { path: 'sites/site_id', response: siteInfo },
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
    method: 'PUT',
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

test('env:set --json should create and return new var (with envelope)', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: 'envelope-value',
      OTHER_VAR: 'envelope-value',
      NEW_VAR: 'new-value',
    }

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:set', '--json', 'NEW_VAR', 'new-value'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:set --json should update existing var (with envelope)', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: 'new-envelope-value',
      OTHER_VAR: 'envelope-value',
    }

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:set', '--json', 'EXISTING_VAR', 'new-envelope-value'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:import should throw error if file not exists (with envelope)', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await t.throwsAsync(() => callCli(['env:import', '.env'], getCLIOptions({ builder, apiUrl })))
    })
  })
})

test('env:import --json should import new vars and override existing vars (with envelope)', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    const finalEnv = {
      EXISTING_VAR: 'from-dotenv',
      OTHER_VAR: 'envelope-value',
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

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:set --json should be able to set var with empty value (with envelope)', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: '',
      OTHER_VAR: 'envelope-value',
    }

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:set', '--json', 'EXISTING_VAR', ''],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:unset --json should remove existing variable (with envelope)', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      OTHER_VAR: 'envelope-value',
    }

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(
        ['env:unset', '--json', 'EXISTING_VAR'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:import --json --replace-existing should replace all existing vars and return imported (with envelope)', async (t) => {
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
        ['env:import', '--replaceExisting', '--json', '.env'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:migrate should return success message (mongo to envelope)', async (t) => {
  const envFrom = {
    MIGRATE_ME: 'migrate_me',
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

  const migrateRoutes = [
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
    await withMockApi(migrateRoutes, async ({ apiUrl, requests }) => {
      const cliResponse = await callCli(
        ['env:migrate', '--from', 'site_id_a', '--to', 'site_id_b'],
        getCLIOptions({ apiUrl, builder }),
      )

      t.snapshot(normalize(cliResponse))

      const deleteRequest = requests.find((request) => request.method === 'DELETE')
      t.is(deleteRequest.path, '/api/v1/accounts/test-account/env/EXISTING_VAR')

      const postRequest = requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )

      t.is(postRequest.body.length, 2)
      t.is(postRequest.body[0].key, 'MIGRATE_ME')
      t.is(postRequest.body[0].values[0].value, 'migrate_me')
      t.is(postRequest.body[1].key, 'EXISTING_VAR')
      t.is(postRequest.body[1].values[0].value, 'from')
    })
  })
})

test('env:migrate should return success message (envelope to mongo)', async (t) => {
  const siteInfoFrom = {
    ...siteInfo,
    id: 'site_id_a',
    name: 'site-name-a',
  }

  const envTo = {
    MIGRATE_ME: 'migrate_me',
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
    EXISTING_VAR: 'envelope-value',
    OTHER_VAR: 'envelope-value',
  }

  const migrateRoutes = [
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
    await withMockApi(migrateRoutes, async ({ apiUrl, requests }) => {
      const cliResponse = await callCli(
        ['env:migrate', '--from', 'site_id_a', '--to', 'site_id_b'],
        getCLIOptions({ apiUrl, builder }),
      )

      t.snapshot(normalize(cliResponse))

      const patchRequest = requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/sites/site_id_b',
      )

      t.deepEqual(patchRequest.body, { build_settings: { env: finalEnv } })
    })
  })
})

test('env:migrate should return success message (envelope to envelope)', async (t) => {
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

  const migrateRoutes = [
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
    await withMockApi(migrateRoutes, async ({ apiUrl, requests }) => {
      const cliResponse = await callCli(
        ['env:migrate', '--from', 'site_id_a', '--to', 'site_id_b'],
        getCLIOptions({ apiUrl, builder }),
      )

      t.snapshot(normalize(cliResponse))

      const deleteRequests = requests.filter((request) => request.method === 'DELETE')
      t.is(deleteRequests.length, 2)

      const postRequest = requests.find((request) => request.method === 'POST')
      t.deepEqual(
        postRequest.body.map(({ key }) => key),
        ['EXISTING_VAR', 'OTHER_VAR'],
      )
    })
  })
})
