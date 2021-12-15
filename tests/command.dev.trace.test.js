import test from 'ava'

import callCli from './utils/call-cli.js'
import { withSiteBuilder } from './utils/site-builder.js'

test('routing-local-proxy does not match redirect for empty site', async (t) => {
  await withSiteBuilder('empty-site', async (builder) => {
    await builder.buildAsync()

    const output = await callCli(['dev:trace', 'http://localhost/routing-path'], {
      cwd: builder.directory,
    })

    t.is(output.includes("request didn't match any rule"), true)
  })
})

test('routing-local-proxy matches redirect when url matches', async (t) => {
  await withSiteBuilder('site-with-redirects', async (builder) => {
    builder.withRedirectsFile({
      redirects: [{ from: '/*', to: `/index.html`, status: 200 }],
    })
    await builder.buildAsync()

    const output = await callCli(['dev:trace', 'http://localhost/routing-path'], {
      cwd: builder.directory,
    })

    t.is(output.includes('mapped remap found'), true)
  })
})
