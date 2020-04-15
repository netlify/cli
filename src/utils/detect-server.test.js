const test = require('ava')
const path = require('path')
const { loadDetector, serverSettings, chooseDefaultArgs } = require('./detect-server')
const sitePath = path.join(__dirname, '..', 'tests', 'dummy-site')

process.chdir(sitePath)

test('loadDetector: valid', t => {
  const d = loadDetector('cra.js')
  t.is(typeof d, 'function')
})

test('loadDetector: invalid', t => {
  t.throws(() => {
    loadDetector('cry.js')
  }, /Failed to load detector/)
})

test('serverSettings: minimal config', async t => {
  const env = { ...process.env }
  const settings = await serverSettings({ framework: '#auto' })
  t.deepEqual(settings.env, env)
  t.is(settings.framework, undefined)
})

test('serverSettings: "#static" as "framework', async t => {
  const settings = await serverSettings({ framework: '#static' })
  t.is(settings.framework, '#static')
})

test('serverSettings: "command" override', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#auto', command: 'npm run dev' }
  const settings = await serverSettings(devConfig)
  t.is(settings.framework, undefined)
  t.is(settings.command, devConfig.command)
  t.deepEqual(settings.env, env)
})

test('chooseDefaultArgs', t => {
  const possibleArgsArrs = [['run', 'dev'], ['run develop']]
  const args = chooseDefaultArgs(possibleArgsArrs)
  t.deepEqual(args, possibleArgsArrs[0])
})
