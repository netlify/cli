const process = require('process')

const test = require('ava')

const callCli = require('./utils/call-cli')
const { generateSiteName, createLiveTestSite } = require('./utils/create-live-test-site')
const { createSiteBuilder } = require('./utils/site-builder')

const siteName = generateSiteName('netlify-test-lm-')

if (process.env.IS_FORK !== 'true') {
  test.before(async (t) => {
    const { siteId } = await createLiveTestSite(siteName)
    const builder = createSiteBuilder({ siteName: 'site-with-lm' })
    await builder.buildAsync()

    t.context.execOptions = {
      cwd: builder.directory,
      env: { NETLIFY_SITE_ID: siteId, SHELL: process.env.SHELL || 'bash' },
    }
    t.context.builder = builder
  })

  test.serial('netlify lm:info', async (t) => {
    const cliResponse = await callCli(['lm:info'], t.context.execOptions)
    t.true(cliResponse.includes('Checking Git version'))
    t.true(cliResponse.includes('Checking Git LFS version'))
    t.true(cliResponse.includes('Checking Git LFS filters'))
    t.true(cliResponse.includes("Checking Netlify's Git Credentials version"))
  })

  test.serial('netlify lm:install', async (t) => {
    const cliResponse = await callCli(['lm:install'], t.context.execOptions)
    t.true(cliResponse.includes('Checking Git version'))
    t.true(cliResponse.includes('Checking Git LFS version'))
    t.true(cliResponse.includes('Checking Git LFS filters'))
    t.true(cliResponse.includes("Installing Netlify's Git Credential Helper"))
    t.true(cliResponse.includes("Configuring Git to use Netlify's Git Credential Helper [started]"))
    t.true(cliResponse.includes("Configuring Git to use Netlify's Git Credential Helper [completed]"))
  })

  test.serial('netlify lm:setup', async (t) => {
    // Skip the actual setup test as the site needs to be associated with the repo to provision a large media addon.
    const cliResponse = await callCli(['lm:setup'], t.context.execOptions)
    t.true(cliResponse.includes('Provisioning Netlify Large Media'))
    t.true(cliResponse.includes("Large Media addon doesn't support manual deploy"))
  })

  test.after('cleanup', async (t) => {
    const { execOptions, builder } = t.context
    console.log('Performing cleanup')
    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await callCli(['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)

    await builder.cleanupAsync()
  })
}
