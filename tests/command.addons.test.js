const test = require('ava')
const { createSiteBuilder } = require('./utils/siteBuilder')
const callCli = require('./utils/callCli')
const { generateSiteName, createLiveTestSite } = require('./utils/createLiveTestSite')

const siteName = generateSiteName('netlify-test-addons-')

if (process.env.IS_FORK !== 'true') {
  test.before(async t => {
    const siteId = await createLiveTestSite(siteName)
    const builder = createSiteBuilder({ siteName: 'site-with-addons' })
    await builder.buildAsync()

    t.context.execOptions = { cwd: builder.directory, env: { NETLIFY_SITE_ID: siteId } }
    t.context.builder = builder
  })

  test.serial('netlify addons:list', async t => {
    const regex = /No addons currently installed/
    const cliResponse = await callCli(['addons:list'], t.context.execOptions)
    t.is(regex.test(cliResponse), true)
  })

  test.serial('netlify addons:list --json', async t => {
    const cliResponse = await callCli(['addons:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)
    t.is(Array.isArray(json), true)
    t.is(json.length, 0)
  })

  test.serial('netlify addons:create demo', async t => {
    const regex = /Add-on "demo" created/
    const cliResponse = await callCli(['addons:create', 'demo', '--TWILIO_ACCOUNT_SID', 'lol'], t.context.execOptions)
    t.is(regex.test(cliResponse), true)
  })

  test.serial('After creation netlify addons:list --json', async t => {
    const cliResponse = await callCli(['addons:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)
    t.is(Array.isArray(json), true)
    t.is(json.length, 1)
    t.is(json[0].service_slug, 'demo')
  })

  test.serial('netlify addon:delete demo', async t => {
    const regex = /Addon "demo" deleted/
    const cliResponse = await callCli(['addons:delete', 'demo', '-f'], t.context.execOptions)
    t.is(regex.test(cliResponse), true)
  })

  test.after('cleanup', async t => {
    const { execOptions, builder } = t.context

    console.log('Performing cleanup')
    // Run cleanup
    await callCli(['addons:delete', 'demo', '-f'], execOptions)

    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await callCli(['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)

    await builder.cleanupAsync()
  })
}
