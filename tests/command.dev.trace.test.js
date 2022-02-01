const callCli = require('./utils/call-cli')
const { withSiteBuilder } = require('./utils/site-builder')

test('routing-local-proxy does not match redirect for empty site', async () => {
  await withSiteBuilder('empty-site', async (builder) => {
    await builder.buildAsync()

    const output = await callCli(['dev:trace', 'http://localhost/routing-path'], {
      cwd: builder.directory,
    })

    expect(output.includes("request didn't match any rule")).toBe(true)
  })
})

test('routing-local-proxy matches redirect when url matches', async () => {
  await withSiteBuilder('site-with-redirects', async (builder) => {
    builder.withRedirectsFile({
      redirects: [{ from: '/*', to: `/index.html`, status: 200 }],
    })
    await builder.buildAsync()

    const output = await callCli(['dev:trace', 'http://localhost/routing-path'], {
      cwd: builder.directory,
    })

    expect(output.includes('mapped remap found')).toBe(true)
  })
})
