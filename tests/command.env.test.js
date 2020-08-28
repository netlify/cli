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

// Input and return values for each test scenario:
const ENV_VAR_STATES = {
  set: {
    SOME_VAR1: 'FOO',
  },
  update: {
    SOME_VAR1: 'FOOBAR',
  },
  get: {
    SOME_VAR1: 'FOOBAR',
  },
  import: {
    SOME_VAR1: 'FOOBARBUZZ', // update existing SOME_VAR1
    SOME_VAR2: 'FOO', // import new var
  },
  netlifyToml: { SOME_VAR2: 'FOO_NETLIFY_TOML' }, // should take priority over existing SOME_VAR2
  unset: { SOME_VAR1: '' },
}
const ENV_FILE_NAME = '.env'
const FAIL_ENV_FILE_NAME = '.env.unknown' // file which should result in error

async function listAccounts() {
  return JSON.parse(await callCli(['api', 'listAccountsForUser']))
}

async function injectNetlifyToml(builder) {
  const builderWithToml = builder.withNetlifyToml({
    config: {
      build: {
        environment: ENV_VAR_STATES.netlifyToml,
      },
    },
  })
  await builderWithToml.buildAsync()
  return builderWithToml
}

function checkResultState({ t, state, result }) {
  const expectedPairs = Object.entries(state)
  expectedPairs.forEach(([key, value]) => {
    t.is(result[key], value)
  })
}

function getArgsFromState(state) {
  return Object.entries(state)[0]
}

if (process.env.IS_FORK !== 'true') {
  test.before(async t => {
    const accounts = await listAccounts()
    t.is(Array.isArray(accounts), true)
    t.truthy(accounts.length)

    const account = accounts[0]

    const builder = createSiteBuilder({ siteName: 'site-with-env-vars' }).withEnvFile({
      path: ENV_FILE_NAME,
      env: ENV_VAR_STATES.import,
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
    const key = getArgsFromState(ENV_VAR_STATES.get)[0]

    const cliResponse = await callCli(['env:get', '--json', key], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.true(isEmpty(json))
  })

  test.serial('env:set --json should create and return new var', async t => {
    const state = ENV_VAR_STATES.set

    const cliResponse = await callCli(['env:set', '--json', ...getArgsFromState(state)], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    checkResultState({ t, result: json, state })
  })

  test.serial('env:set --json should update existing var', async t => {
    const state = ENV_VAR_STATES.update

    const cliResponse = await callCli(['env:set', '--json', ...getArgsFromState(state)], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    checkResultState({ t, result: json, state })
  })

  test.serial('env:get --json should return value of existing var', async t => {
    const [key, value] = getArgsFromState(ENV_VAR_STATES.get)

    const cliResponse = await callCli(['env:get', '--json', key], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(Object.keys(json).length, 1)
    t.is(json[key], value)
  })

  test.serial('env:import should throw error if file not exists', async t => {
    await t.throwsAsync(async () => {
      await callCli(['env:import', FAIL_ENV_FILE_NAME], t.context.execOptions)
    })
  })

  test.serial('env:import --json should set new vars and update existing vars', async t => {
    const cliResponse = await callCli(['env:import', '--json', ENV_FILE_NAME], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    checkResultState({ t, result: json, state: ENV_VAR_STATES.import })
  })

  test.serial('env:get --json should return value of var from netlify.toml', async t => {
    // Add netlify.toml before running all following tests as they check
    // right behavior with netlify.toml.
    t.context.builder = await injectNetlifyToml(t.context.builder)

    const [key, value] = getArgsFromState(ENV_VAR_STATES.netlifyToml)

    const cliResponse = await callCli(['env:get', '--json', key], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.is(Object.keys(json).length, 1)
    t.is(json[key], value)
  })

  test.serial('env:list --json should return list of vars with netlify.toml taking priority', async t => {
    const cliResponse = await callCli(['env:list', '--json'], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))

    const merged = { ...ENV_VAR_STATES.import, ...ENV_VAR_STATES.netlifyToml } // netlifyToml last, so that it overrides duplicates from import
    checkResultState({ t, result: json, state: merged })
  })

  test.serial('env:set --json should unset var if value is set empty', async t => {
    const args = getArgsFromState(ENV_VAR_STATES.unset)
    const key = args[0]

    const cliResponse = await callCli(['env:set', '--json', ...args], t.context.execOptions)
    const json = JSON.parse(cliResponse)

    t.true(isObject(json))
    t.falsy(key in json)
  })

  test.after('cleanup', async t => {
    const { execOptions, builder } = t.context

    console.log('Performing cleanup')

    console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
    await callCli(['sites:delete', execOptions.env.NETLIFY_SITE_ID, '--force'], execOptions)

    await builder.cleanupAsync()
  })
}
