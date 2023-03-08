const test = require('ava')

const callCli = require('./utils/call-cli.cjs')
const { getCLIOptions, withMockApi } = require('./utils/mock-api.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')
const { normalize } = require('./utils/snapshots.cjs')

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
    method: 'DELETE',
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR/value/3456',
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

test('env:list --json should return the object of keys and values', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const finalEnv = {
      EXISTING_VAR: 'envelope-dev-value',
      OTHER_VAR: 'envelope-all-value',
    }

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['env:list', '--json'], getCLIOptions({ builder, apiUrl }), true)

      t.deepEqual(cliResponse, finalEnv)
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

      t.deepEqual(cliResponse, finalEnv)
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

      t.deepEqual(cliResponse, finalEnv)
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

      t.deepEqual(cliResponse, finalEnv)

      const postRequest = requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )

      t.is(postRequest.body[0].key, 'NEW_VAR')
      t.is(postRequest.body[0].values[0].context, 'dev')
      t.is(postRequest.body[0].values[0].value, 'new-value')
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

      t.deepEqual(cliResponse, finalEnv)

      const patchRequest = requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )

      t.is(patchRequest.body.context, 'dev')
      t.is(patchRequest.body.value, 'envelope-new-value')
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

      t.deepEqual(cliResponse, finalEnv)

      const patchRequests = requests.filter(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )

      t.is(patchRequests.length, 2)

      // The order of the request might not be always the same, so we need to find the request
      const dpRequest = patchRequests.find((request) => request.body.context === 'deploy-preview')
      t.not(dpRequest, undefined)
      t.is(dpRequest.body.value, 'multiple')

      const prodRequest = patchRequests.find((request) => request.body.context === 'production')
      t.not(prodRequest, undefined)
      t.is(prodRequest.body.value, 'multiple')
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

      t.deepEqual(cliResponse, finalEnv)

      const putRequest = requests.find(
        (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )

      t.is(putRequest.body.key, 'EXISTING_VAR')
      t.is(putRequest.body.values[0].context, 'all')
      t.is(putRequest.body.values[0].value, 'new-envelope-value')
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

      t.deepEqual(cliResponse, finalEnv)

      const putRequest = requests.find(
        (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )

      t.is(putRequest.body.values[0].context, 'production')
      t.is(putRequest.body.values[1].context, 'dev')
      t.is(putRequest.body.scopes[0], 'runtime')
      t.is(putRequest.body.scopes[1], 'post-processing')
    })
  })
})

test('env:set should error when --scope and --context are passed on an existing env var', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stderr: cliResponse } = await t.throwsAsync(
        callCli(
          ['env:set', 'EXISTING_VAR', '--scope', 'functions', '--context', 'production'],
          getCLIOptions({ builder, apiUrl }),
        ),
      )

      t.true(
        cliResponse.includes(`Setting the context and scope at the same time on an existing env var is not allowed`),
      )
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

      t.deepEqual(cliResponse, finalEnv)

      const deleteRequest = requests.find((request) => request.method === 'DELETE')
      t.is(deleteRequest.path, '/api/v1/accounts/test-account/env/EXISTING_VAR')
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

      t.deepEqual(cliResponse, finalEnv)

      const deleteRequest = requests.find((request) => request.method === 'DELETE')
      t.is(deleteRequest.path, '/api/v1/accounts/test-account/env/EXISTING_VAR/value/1234')
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

      t.deepEqual(cliResponse, finalEnv)

      const deleteRequest = requests.find((request) => request.method === 'DELETE')
      t.is(deleteRequest.path, '/api/v1/accounts/test-account/env/OTHER_VAR/value/3456')

      const patchRequests = requests.filter(
        (request) => request.method === 'PATCH' && '/api/v1/accounts/test-account/env/OTHER_VAR',
      )

      t.is(patchRequests.length, 3)
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
