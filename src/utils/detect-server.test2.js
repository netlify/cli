const test = require('ava')
const path = require('path')
const { serverSettings } = require('./detect-server')
const craSitePath = path.join(__dirname, '..', '..', 'tests', 'site-cra')

process.chdir(craSitePath)

test.serial('serverSettings: set "framework" to "create-react-app"', async t => {
  const devConfig = { framework: 'create-react-app', publish: 'public' }
  const settings = await serverSettings(devConfig, {}, craSitePath,  () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.dist, devConfig.publish)
})
