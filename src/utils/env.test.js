const test = require('ava')
const path = require('path')
const { getEnvFile } = require('./env')

const contextSite = path.join(__dirname, '..', '..', 'tests', 'context-site')
const dummySite = path.join(__dirname, '..', '..', 'tests', 'dummy-site')
const craSite = path.join(__dirname, '..', '..', 'tests', 'site-cra')

test('no .env files', async t => {
  const f = await getEnvFile(contextSite)
  t.is(f, undefined)
})

test('.env.development file', async t => {
  const f = await getEnvFile(dummySite)
  t.is(f, path.resolve(dummySite, '.env.development'))
})

test('.env file', async t => {
  const f = await getEnvFile(craSite)
  t.is(f, path.resolve(craSite, '.env'))
})
