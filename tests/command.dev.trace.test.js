const test = require('ava')

const { installTrafficMesh } = require('../src/utils/traffic-mesh')

const callCli = require('./utils/call-cli')
const { withSiteBuilder } = require('./utils/site-builder')

test.before(async () => {
  // pre-install the traffic mesh agent so we can run the tests in parallel
  await installTrafficMesh({ log: console.log })
})

test('should not match redirect for empty site', async (t) => {
  await withSiteBuilder('empty-site', async (builder) => {
    await builder.buildAsync()

    const output = await callCli(['dev:trace', 'http://localhost/routing-path'], {
      cwd: builder.directory,
    })

    t.is(output.includes("request didn't match any rule"), true)
  })
})

test('should match redirect when url matches', async (t) => {
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
