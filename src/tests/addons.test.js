const path = require('path')
const test = require('ava')
const stripAnsi = require('strip-ansi')
const cliPath = require('./utils/cliPath')
const exec = require('./utils/exec')
const sitePath = path.join(__dirname, 'dummy-site')

const execOptions = {
  stdio: [0, 1, 2],
  cwd: sitePath,
  env: Object.assign(process.env, {
    NETLIFY_AUTH_TOKEN: process.env.NETLIFY_AUTH_TOKEN
  })
}

const siteName =
  'netlify-test-' +
  Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(0, 8)

async function deleteAddon(name) {
  const cliResponse = await exec(`${cliPath} addons:delete ${name} -f`, execOptions)
  return cliResponse
}

test.before(async t => {
  console.log('creating new site for tests: ' + siteName)
  const cliResponse = await exec(
    `${cliPath} sites:create --name="${siteName}" --account-slug="netlify-services"`,
    execOptions
  )
  t.is(/Site Created/.test(cliResponse.stdout), true)

  const matches = /Site ID:\s+([a-zA-Z0-9-]+)/m.exec(stripAnsi(cliResponse.stdout))
  t.truthy(matches)
  t.truthy(matches.hasOwnProperty(1))
  t.truthy(matches[1])
  // Set the site id
  execOptions.env.NETLIFY_SITE_ID = matches[1]
})

test.serial('netlify addons:list', async t => {
  const regex = /No addons currently installed/
  const cliResponse = await exec(`${cliPath} addons:list`, execOptions)
  t.is(regex.test(cliResponse.stdout), true)
})

test.serial('netlify addons:list --json', async t => {
  const cliResponse = await exec(`${cliPath} addons:list --json`, execOptions)
  const json = JSON.parse(cliResponse.stdout)
  t.is(Array.isArray(json), true)
  t.is(json.length, 0)
})

test.serial('netlify addons:create demo', async t => {
  const regex = /Add-on "demo" created/
  const cliResponse = await exec(`${cliPath} addons:create demo --TWILIO_ACCOUNT_SID lol`, execOptions)
  t.is(regex.test(cliResponse.stdout), true)
})

test.serial('After creation netlify addons:list --json', async t => {
  const cliResponse = await exec(`${cliPath} addons:list --json`, execOptions)
  const json = JSON.parse(cliResponse.stdout)
  t.is(Array.isArray(json), true)
  t.is(json.length, 1)
  t.is(json[0].service_slug, 'demo')
})

test.serial('netlify addon:delete demo', async t => {
  const regex = /Addon "demo" deleted/
  const cliResponse = await deleteAddon('demo')
  t.is(regex.test(cliResponse.stdout), true)
})

test.after('cleanup', async t => {
  console.log('Performing cleanup')
  // Run cleanup
  await deleteAddon('demo')

  console.log(`deleting test site "${siteName}". ${execOptions.env.NETLIFY_SITE_ID}`)
  await exec(`${cliPath} sites:delete ${execOptions.env.NETLIFY_SITE_ID} --force`, execOptions)
})
