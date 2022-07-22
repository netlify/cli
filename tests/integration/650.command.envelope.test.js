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
    scopes: ['builds', 'functions'],
    values: [
      {
        context: 'production',
        value: 'envelope-prod-value',
      },
      {
        context: 'dev',
        value: 'envelope-dev-value',
      },
    ],
  },
  {
    key: 'OTHER_VAR',
    scopes: ['builds', 'functions', 'runtime', 'post_processing'],
    values: [
      {
        context: 'all',
        value: 'envelope-all-value',
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

test('env:get --json should return empty object if var not set', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, {})
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

      t.is(cliResponse.EXISTING_VAR, 'envelope-prod-value')
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

      t.is(cliResponse.EXISTING_VAR, undefined)
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

      t.is(cliResponse.EXISTING_VAR, 'envelope-dev-value')
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

      t.is(cliResponse.EXISTING_VAR, undefined)
    })
  })
})

test('env:set --json should create and return new var', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: 'envelope-dev-value',
      OTHER_VAR: 'envelope-all-value',
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

test('env:set --json should update existing var', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: 'new-envelope-value',
      OTHER_VAR: 'envelope-all-value',
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

      t.deepEqual(cliResponse, finalEnv)
    })
  })
})

test('env:set --json should be able to set var with empty value', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: '',
      OTHER_VAR: 'envelope-all-value',
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

test('env:unset --json should remove existing variable', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      OTHER_VAR: 'envelope-all-value',
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
        ['env:import', '--replaceExisting', '--json', '.env'],
        getCLIOptions({ builder, apiUrl }),
        true,
      )

      t.deepEqual(cliResponse, finalEnv)
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

      t.snapshot(normalize(cliResponse))

      const deleteRequest = requests.find((request) => request.method === 'DELETE')
      t.is(deleteRequest.path, '/api/v1/accounts/test-account/env/EXISTING_VAR')

      const postRequest = requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )

      t.is(postRequest.body.length, 2)
      t.is(postRequest.body[0].key, 'CLONE_ME')
      t.is(postRequest.body[0].values[0].value, 'clone_me')
      t.is(postRequest.body[1].key, 'EXISTING_VAR')
      t.is(postRequest.body[1].values[0].value, 'from')
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

      t.snapshot(normalize(cliResponse))

      const patchRequest = requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/sites/site_id_b',
      )

      t.deepEqual(patchRequest.body, { build_settings: { env: finalEnv } })
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
