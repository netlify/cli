const test = require('ava')
const path = require('path')
const { loadDetector, serverSettings, chooseDefaultArgs } = require('./detect-server')
const sitePath = path.join(__dirname, '..', 'tests', 'dummy-site')

process.chdir(sitePath)

test('loadDetector: valid', t => {
  const d = loadDetector('create-react-app.js')
  t.is(typeof d, 'function')
})

test('loadDetector: invalid', t => {
  t.throws(() => {
    loadDetector('cry.js')
  }, /Failed to load detector/)
})

test('serverSettings: minimal config', async t => {
  const env = { ...process.env }
  const settings = await serverSettings({ framework: '#auto' }, {}, () => {})
  t.deepEqual(settings.env, env)
  t.is(settings.framework, undefined)
})

test('serverSettings: "#static" as "framework', async t => {
  const settings = await serverSettings({ framework: '#static' }, {}, () => {})
  t.is(settings.framework, undefined)
})

test('serverSettings: "command" override npm', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#auto', command: 'npm run dev' }
  const settings = await serverSettings(devConfig, {}, () => {})
  t.is(settings.framework, undefined)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.deepEqual(settings.env, env)
})

test('serverSettings: "command" override yarn', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#auto', command: 'yarn dev' }
  const settings = await serverSettings(devConfig, {}, () => {})
  t.is(settings.framework, undefined)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.deepEqual(settings.env, env)
})

test('serverSettings: custom framework parameters', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#auto', command: 'yarn dev', port: 8987, targetPort: 3000, publish: sitePath }
  const settings = await serverSettings(devConfig, {}, () => {})
  t.is(settings.framework, undefined)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.deepEqual(settings.env, env)
  t.is(settings.port, devConfig.port)
  t.is(settings.targetPort, devConfig.proxyPort)
  t.is(settings.dist, devConfig.publish)
})

test('serverSettings: "functions" config', async t => {
  const devConfig = { framework: '#auto', functions: path.join(sitePath, 'functions') }
  const settings = await serverSettings(devConfig, {}, () => {})
  t.is(settings.functions, devConfig.functions)
})

test('chooseDefaultArgs', t => {
  const possibleArgsArrs = [['run', 'dev'], ['run develop']]
  const args = chooseDefaultArgs(possibleArgsArrs)
  t.deepEqual(args, possibleArgsArrs[0])
})
