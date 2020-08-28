const test = require('ava')
const { createSiteBuilder } = require('./utils/siteBuilder')
const callCli = require('./utils/callCli')
const createLiveTestSite = require('./utils/createLiveTestSite')
const isObject = require('lodash.isobject')
const isEmpty = require('lodash.isempty')

const siteName =
  'netlify-test-env-' +
  Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(0, 8)

async function listAccounts() {
  return JSON.parse(await callCli(['api', 'listAccountsForUser']))
}

async function injectNetlifyToml(builder) {
  const builderWithToml = builder.withNetlifyToml({
    config: {
      build: {
        environment: {
          SOME_VAR2: 'FOO_NETLIFY_TOML',
        },
      },
    },
  })
  await builderWithToml.buildAsync()
  return builderWithToml
}

if (process.env.IS_FORK !== 'true') {
  test.before(async t => {
    const accounts = await listAccounts()
    t.is(Array.isArray(accounts), true)
    t.truthy(accounts.length)

    const account = accounts[0]

    const builder = createSiteBuilder({ siteName: 'site-with-env-vars' }).withEnvFile({
      path: '.env',
      env: { SOME_VAR1: 'FOOBARBUZZ', SOME_VAR2: 'FOO' },
    })
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

  test.serial('env:list --json should return empty object if no vars set', async t => {
    const cliResponse = await callCli(['env:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.true(isEmpty(json))
  })

  test.serial('env:get --json should return empty object if var not set', async t => {
    const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR'], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.true(isEmpty(json))
  })

  test.serial('env:set --json should create and return new var', async t => {
    const name = 'SOME_VAR1'
    const value = 'FOO'

    const cliResponse = await callCli(['env:set', '--json', name, value], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(json[name], value)
  })

  test.serial('env:set --json should update existing var', async t => {
    const name = 'SOME_VAR1'
    const value = 'FOOBAR'

    const cliResponse = await callCli(['env:set', '--json', name, value], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(json[name], value)
  })

  test.serial('env:get --json should return value of existing var', async t => {
    const name = 'SOME_VAR1'
    const value = 'FOOBAR'

    const cliResponse = await callCli(['env:get', '--json', name], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(Object.keys(json).length, 1)
    t.is(json[name], value)
  })

  test.serial('env:import should throw error if file not exists', async t => {
    const fileName = '.env.unknown'

    await t.throwsAsync(async () => {
      await callCli(['env:import', fileName], t.context.execOptions)
    })
  })

  test.serial('env:import --json should set new vars and update existing vars', async t => {
    const fileName = '.env'

    const cliResponse = await callCli(['env:import', '--json', fileName], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(json['SOME_VAR1'], 'FOOBARBUZZ') // updated var
    t.is(json['SOME_VAR2'], 'FOO') // new var
  })

  test.serial('env:list --json should return list of vars with netlify.toml taking priority', async t => {
    // Add netlify.toml before running all following tests as they check
    // right behavior with netlify.toml.
    t.context.builder = await injectNetlifyToml(t.context.builder)

    const cliResponse = await callCli(['env:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(json['SOME_VAR1'], 'FOOBARBUZZ')
    t.is(json['SOME_VAR2'], 'FOO_NETLIFY_TOML')
  })

  test.serial('env:get --json should return value of var from netlify.toml', async t => {
    const cliResponse = await callCli(['env:get', '--json', 'SOME_VAR2'], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(Object.keys(json).length, 1)
    t.is(json['SOME_VAR2'], 'FOO_NETLIFY_TOML')
  })

  test.serial('env:set --json should unset var if value is set empty', async t => {
    const name = 'SOME_VAR1'

    const cliResponse = await callCli(['env:set', '--json', name, ''], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.falsy(name in json)
  })

  test.after('cleanup', async t => {
    const { execOptions, builder } = t.context

    console.log('Performing cleanup')

    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await callCli(['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)

    await builder.cleanupAsync()
  })
}
