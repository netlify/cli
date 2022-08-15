const test = require('ava')

const callCli = require('./utils/call-cli')
const { getCLIOptions, withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')
const { normalize } = require('./utils/snapshots')

const mongoSite = {
  account_slug: 'test-account',
  build_settings: {
    env: {
      NETLIFY_GRAPH_PERSIST_QUERY_TOKEN: 'zxcv0987',
    },
  },
  id: 'site_id',
  name: 'site-name',
}
const envelopeSite = {
  ...mongoSite,
  use_envelope: true,
}
const envelopeResponse = [
  {
    key: 'NETLIFY_GRAPH_WEBHOOK_SECRET',
    scopes: ['functions'],
    values: [{ context: 'all', value: 'abcd1234' }],
  },
  {
    key: 'NETLIFY_GRAPH_PERSIST_QUERY_TOKEN',
    scopes: ['functions'],
    values: [{ context: 'all', value: 'zxcv0987' }],
  },
]
const routes = (site) => [
  { path: 'sites/site_id', response: site },
  {
    path: 'sites/site_id',
    method: 'PATCH',
    response: {},
  },
  {
    path: 'accounts',
    response: [{ slug: site.account_slug }],
  },
  {
    path: 'sites/site_id/service-instances',
    response: 'uuid-string',
  },
  {
    path: 'accounts/test-account/env',
    method: 'GET',
    response: [envelopeResponse[1]],
  },
  {
    path: 'accounts/test-account/env',
    method: 'POST',
    response: envelopeResponse,
  },
]

test('netlify graph', async (t) => {
  const cliResponse = await callCli(['graph'])
  t.snapshot(normalize(cliResponse))
})

test('netlify graph completion', async (t) => {
  const cliResponse = await callCli(['graph', 'pull'])
  t.snapshot(normalize(cliResponse))
})

test('netlify graph:init with env vars from mongo', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes(mongoSite), async ({ apiUrl, requests }) => {
      const cliResponse = await callCli(['graph:init'], getCLIOptions({ builder, apiUrl }))

      const patchRequest = requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/sites/site_id',
      )

      const WEBHOOK_SECRET_LENGTH = 48
      t.is(patchRequest.body.build_settings.env.NETLIFY_GRAPH_WEBHOOK_SECRET.length, WEBHOOK_SECRET_LENGTH)
      t.is(patchRequest.body.build_settings.env.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN, 'zxcv0987')
      t.true(cliResponse.includes(`Finished updating Graph-related environment variables for site`))
    })
  })
})

test('netlify graph:init with env vars from envelope', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes(envelopeSite), async ({ apiUrl, requests }) => {
      const cliResponse = await callCli(['graph:init'], getCLIOptions({ builder, apiUrl }))

      const postRequest = requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )

      const WEBHOOK_SECRET_LENGTH = 48
      t.is(postRequest.body.length, 1)
      t.is(postRequest.body[0].key, 'NETLIFY_GRAPH_WEBHOOK_SECRET')
      t.is(postRequest.body[0].scopes[0], 'functions')
      t.is(postRequest.body[0].values[0].context, 'all')
      t.is(postRequest.body[0].values[0].value.length, WEBHOOK_SECRET_LENGTH)

      t.true(cliResponse.includes(`Finished updating Graph-related environment variables for site`))
    })
  })
})
