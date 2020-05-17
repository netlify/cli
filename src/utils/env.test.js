const test = require('ava')
const path = require('path')
const { getEnvSettings } = require('./env')

const contextSite = path.join(__dirname, '..', '..', 'tests', 'context-site')
const dummySite = path.join(__dirname, '..', '..', 'tests', 'dummy-site')
const craSite = path.join(__dirname, '..', '..', 'tests', 'site-cra')

test('no .env files', async t => {
  const vars = await getEnvSettings(contextSite)
  t.deepEqual(vars, {})
})

test('.env.development file', async t => {
  const vars = await getEnvSettings(dummySite)
  t.deepEqual(vars, {
    file: path.resolve(dummySite, '.env.development'),
    vars: {
      EASY_VAR: 'true',
      DUMMY_VAR: 'false',
    },
  })
})

test('.env file', async t => {
  const vars = await getEnvSettings(craSite)
  t.deepEqual(vars, {
    file: path.resolve(craSite, '.env'),
    vars: {},
  })
})
