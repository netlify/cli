const path = require('path')
const test = require('ava')
const cliPath = require('./utils/cliPath')
const exec = require('./utils/exec')
const sitePath = path.join(__dirname, 'dummy-site')

const execOptions = {
  stdio: [0, 1, 2],
  cwd: sitePath,
  env: {
    ...process.env,
    NETLIFY_AUTH_TOKEN: process.env.NETLIFY_AUTH_TOKEN,
    NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID
  },
}

async function deleteAddon(name) {
  const cliResponse = await exec(`${cliPath} addons:delete ${name}`, execOptions)
  return cliResponse
}

// test.before(t => {
//   // create site
// })

test.serial('netlify addon:list', async (t) => {
  const regex = /^No addons currently installed/
  const cliResponse = await exec(`${cliPath} addons:list`, execOptions)
  t.is(regex.test(cliResponse.stdout), true)
})

test.serial('netlify addon:list --json', async (t) => {
  const cliResponse = await exec(`${cliPath} addons:list --json`, execOptions)
  const json = JSON.parse(cliResponse.stdout)
  t.is(Array.isArray(json), true)
  t.is(json.length, 0)
})

test.serial('netlify addon:create demo', async (t) => {
  const regex = /Add-on "demo" created/
  const cliResponse = await exec(`${cliPath} addons:create demo --TWILIO_ACCOUNT_SID lol`, execOptions)
  t.is(regex.test(cliResponse.stdout), true)
})

test.serial('After creation netlify addon:list --json', async (t) => {
  const cliResponse = await exec(`${cliPath} addons:list --json`, execOptions)
  const json = JSON.parse(cliResponse.stdout)
  t.is(Array.isArray(json), true)
  t.is(json.length, 1)
  t.is(json[0].service_slug, 'demo')
})

test.serial('netlify addon:delete demo', async (t) => {
  const regex = /Add-on "demo" deleted/
  const cliResponse = await deleteAddon('demo')
  t.is(regex.test(cliResponse.stdout), true)
})

test.after('cleanup', async t => {
  console.log('Performing cleanup')
  // Run cleanup
  await deleteAddon('demo')
})