const test = require('ava')

const callCli = require('./utils/call-cli')
const { generateSiteName, createLiveTestSite } = require('./utils/create-live-test-site')
const { createSiteBuilder } = require('./utils/site-builder')

const siteName = generateSiteName('netlify-test-addons-')

if (process.env.IS_FORK !== 'true') {
  test.before(async (t) => {
    const siteId = await createLiveTestSite(siteName)
    const builder = createSiteBuilder({ siteName: 'site-with-addons' })
    await builder.buildAsync()

    t.context.execOptions = { cwd: builder.directory, env: { NETLIFY_SITE_ID: siteId } }
    t.context.builder = builder
  })

  test.serial('netlify addons:list', async (t) => {
    const cliResponse = await callCli(['addons:list'], t.context.execOptions)
    t.true(cliResponse.includes('No addons currently installed'))
  })

  test.serial('netlify addons:list --json', async (t) => {
    const cliResponse = await callCli(['addons:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)
    t.true(Array.isArray(json))
    t.is(json.length, 0)
  })

  test.serial('netlify addons:create demo', async (t) => {
    const cliResponse = await callCli(['addons:create', 'demo', '--TWILIO_ACCOUNT_SID', 'foo'], t.context.execOptions)
    t.true(cliResponse.includes('Add-on "demo" created'))
  })

  test.serial('After creation netlify addons:list --json', async (t) => {
    const cliResponse = await callCli(['addons:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)
    t.true(Array.isArray(json))
    t.is(json.length, 1)
    t.is(json[0].service_slug, 'demo')
  })

  test.serial('netlify addons:config demo', async (t) => {
    const cliResponse = await callCli(['addons:config', 'demo', '--TWILIO_ACCOUNT_SID', 'bar'], t.context.execOptions)
    t.true(cliResponse.includes('Updating demo add-on config values'))
    t.true(cliResponse.includes('Add-on "demo" successfully updated'))
  })

  test.serial('netlify addon:delete demo', async (t) => {
    const cliResponse = await callCli(['addons:delete', 'demo', '-f'], t.context.execOptions)
    t.true(cliResponse.includes('Addon "demo" deleted'))
  })

  test.after('cleanup', async (t) => {
    const { execOptions, builder } = t.context
    console.log('Performing cleanup')
    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await callCli(['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)

    await builder.cleanupAsync()
  })
}
