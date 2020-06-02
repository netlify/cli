const path = require('path')
const test = require('ava')
const stripAnsi = require('strip-ansi')
const cliPath = require('./utils/cliPath')
const exec = require('./utils/exec')
const sitePath = path.join(__dirname, 'dummy-site')

const execOptions = {
  cwd: sitePath,
  env: { ...process.env },
  windowsHide: true,
  windowsVerbatimArguments: true,
}

const siteName =
  'netlify-test-' +
  Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(0, 8)

async function callCli(args) {
  return (await exec(cliPath, args, execOptions)).stdout
}

async function listAccounts() {
  return JSON.parse(await callCli(['api', 'listAccountsForUser']))
}

async function createSite(siteName, accountSlug) {
  const cliResponse = await callCli(['sites:create', '--name', siteName, '--account-slug', accountSlug])

  const isSiteCreated = /Site Created/.test(cliResponse)
  if (!isSiteCreated) {
    return null
  }

  const matches = /Site ID:\s+([a-zA-Z0-9-]+)/m.exec(stripAnsi(cliResponse))
  if (matches && matches.hasOwnProperty(1) && matches[1]) {
    return matches[1]
  }

  return null
}

async function deleteAddon(name) {
  return await callCli(['addons:delete', name, '-f'])
}

if (process.env.IS_FORK !== 'true') {
  test.before(async t => {
    const accounts = await listAccounts()
    t.is(Array.isArray(accounts), true)
    t.truthy(accounts.length)

    const account = accounts[0]

    console.log('creating new site for tests: ' + siteName)
    const siteId = await createSite(siteName, account.slug)
    t.truthy(siteId != null)

    execOptions.env.NETLIFY_SITE_ID = siteId
  })

  test.serial('netlify addons:list', async t => {
    const regex = /No addons currently installed/
    const cliResponse = await exec(cliPath, ['addons:list'], execOptions)
    t.is(regex.test(cliResponse.stdout), true)
  })

  test.serial('netlify addons:list --json', async t => {
    const cliResponse = await exec(cliPath, ['addons:list', '--json'], execOptions)
    const json = JSON.parse(cliResponse.stdout)
    t.is(Array.isArray(json), true)
    t.is(json.length, 0)
  })

  test.serial('netlify addons:create demo', async t => {
    const regex = /Add-on "demo" created/
    const cliResponse = await exec(cliPath, ['addons:create', 'demo', '--TWILIO_ACCOUNT_SID', 'lol'], execOptions)
    t.is(regex.test(cliResponse.stdout), true)
  })

  test.serial('After creation netlify addons:list --json', async t => {
    const cliResponse = await exec(cliPath, ['addons:list', '--json'], execOptions)
    const json = JSON.parse(cliResponse.stdout)
    t.is(Array.isArray(json), true)
    t.is(json.length, 1)
    t.is(json[0].service_slug, 'demo')
  })

  test.serial('netlify addon:delete demo', async t => {
    const regex = /Addon "demo" deleted/
    const cliResponse = await deleteAddon('demo')
    t.is(regex.test(cliResponse), true)
  })

  test.after('cleanup', async t => {
    console.log('Performing cleanup')
    // Run cleanup
    await deleteAddon('demo')

    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await exec(cliPath, ['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)
  })
}
