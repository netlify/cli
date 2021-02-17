const os = require('os')
const process = require('process')

const test = require('ava')
const execa = require('execa')
const ini = require('ini')

const { readFileAsync } = require('../src/lib/fs')
const { getPathInHome } = require('../src/lib/settings')

const callCli = require('./utils/call-cli')
const { generateSiteName, createLiveTestSite } = require('./utils/create-live-test-site')
const { startMockApi } = require('./utils/mock-api')
const { createSiteBuilder } = require('./utils/site-builder')

const siteName = generateSiteName('netlify-test-lm-')

if (process.env.IS_FORK !== 'true') {
  test.before(async (t) => {
    const { siteId } = await createLiveTestSite(siteName)
    const builder = createSiteBuilder({ siteName: 'site-with-lm' })
    await builder.buildAsync()

    const { server } = startMockApi({
      routes: [
        { method: 'post', path: 'sites/site_id/services/large-media/instances', status: 201 },
        { path: 'sites/site_id', response: { id_domain: 'localhost' } },
      ],
    })

    t.context.execOptions = {
      cwd: builder.directory,
      env: { NETLIFY_SITE_ID: siteId, SHELL: process.env.SHELL || 'bash' },
    }
    t.context.builder = builder
    t.context.mockApi = server
    t.context.apiUrl = `http://localhost:${server.address().port}/api/v1`

    await callCli(['lm:uninstall'], t.context.execOptions)
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

    // verify git-credential-netlify was added to the PATH
    if (os.platform() === 'win32') {
      t.true(cliResponse.includes(`Adding ${getPathInHome(['helper', 'bin'])} to the`))
      t.true(cliResponse.includes('Netlify Credential Helper for Git was installed successfully.'))
      // no good way to test that it was added to the PATH on windows so we test it was installed
      // in the expected location
      const { stdout } = await execa('git-credential-netlify', ['version'], {
        cwd: `${os.homedir()}\\AppData\\Roaming\\netlify\\config\\helper\\bin`,
      })
      t.true(stdout.startsWith('git-credential-netlify'))
    } else {
      t.true(cliResponse.includes('Run this command to use Netlify Large Media in your current shell'))
      const [source] = cliResponse.match(/source.+inc/)
      const { stdout } = await execa.command(`${source} && git-credential-netlify version`, {
        shell: t.context.execOptions.env.SHELL,
      })
      t.true(stdout.startsWith('git-credential-netlify'))
    }
  })

  test.serial('netlify lm:setup', async (t) => {
    const cliResponse = await callCli(['lm:setup'], {
      ...t.context.execOptions,
      env: { ...t.context.execOptions.env, NETLIFY_SITE_ID: 'site_id', NETLIFY_API_URL: t.context.apiUrl },
    })
    t.true(cliResponse.includes('Provisioning Netlify Large Media [started]'))
    t.true(cliResponse.includes('Provisioning Netlify Large Media [completed]'))
    t.true(cliResponse.includes('Configuring Git LFS for this site [started]'))
    t.true(cliResponse.includes('Configuring Git LFS for this site [completed]'))

    const lfsConfig = ini.parse(await readFileAsync(`${t.context.builder.directory}/.lfsconfig`, 'utf8'))
    t.is(lfsConfig.lfs.url, 'https://localhost/.netlify/large-media')
  })

  test.after('cleanup', async (t) => {
    const { execOptions, builder, mockApi } = t.context
    console.log('Performing cleanup')
    await callCli(['lm:uninstall'], t.context.execOptions)
    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await callCli(['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)

    await builder.cleanupAsync()
    mockApi.close()
  })
}
