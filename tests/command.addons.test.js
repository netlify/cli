const test = require('ava')
const { createSiteBuilder } = require('./utils/siteBuilder')
const callCli = require('./utils/callCli')
const createLiveTestSite = require('./utils/createLiveTestSite')

const siteName =
  'netlify-test-addons-' +
  Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(0, 8)

async function listAccounts() {
  return JSON.parse(await callCli(['api', 'listAccountsForUser']))
}

if (process.env.IS_FORK !== 'true') {
  test.before(async t => {
    const accounts = await listAccounts()
    t.is(Array.isArray(accounts), true)
    t.truthy(accounts.length)

    const account = accounts[0]

    const builder = createSiteBuilder({ siteName: 'site-with-addons' })
    await builder.buildAsync()

    const execOptions = {
      cwd: builder.directory,
      windowsHide: true,
      windowsVerbatimArguments: true,
    }

    console.log('creating new site for tests: ' + siteName)
    const siteId = await createLiveTestSite(siteName, account.slug, execOptions)
    t.truthy(siteId != null)

    t.context.execOptions = { ...execOptions, env: { ...process.env, NETLIFY_SITE_ID: siteId } }
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
