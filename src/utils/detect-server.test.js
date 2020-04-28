const test = require('ava')
const path = require('path')
const getPort = require('get-port')
const { loadDetector, serverSettings, chooseDefaultArgs } = require('./detect-server')
const sitePath = path.join(__dirname, '..', '..', 'tests', 'dummy-site')

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
  const settings = await serverSettings({ framework: '#auto' }, {}, sitePath, () => {})
  t.deepEqual(settings.env, env)
  t.is(settings.framework, undefined)
})

test('serverSettings: "#static" as "framework"', async t => {
  const settings = await serverSettings({ framework: '#static' }, {}, sitePath,  () => {})
  t.is(settings.framework, undefined)
})

test('serverSettings: throw if "port" not available', async t => {
  const port = await getPort({ port: 1 })
  await t.throwsAsync(async () => {
    await serverSettings({ framework: '#auto', port }, {}, sitePath, () => {})
  }, /Could not acquire required "port"/)
})

test('serverSettings: "command" override npm', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#custom', command: 'npm run dev', targetPort: 1234 }
  const settings = await serverSettings(devConfig, {}, sitePath, () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.deepEqual(settings.env, env)
})

test('serverSettings: "command" override yarn', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#custom', command: 'yarn dev', targetPort: 1234 }
  const settings = await serverSettings(devConfig, {}, sitePath, () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.deepEqual(settings.env, env)
})

test('serverSettings: custom framework parameters', async t => {
  const env = { ...process.env }
  const devConfig = { framework: '#custom', command: 'yarn dev', targetPort: 3000, publish: sitePath }
  const settings = await serverSettings(devConfig, {}, sitePath, () => {})
  t.is(settings.framework, '#custom')
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.deepEqual(settings.env, env)
  t.is(settings.targetPort, devConfig.proxyPort)
  t.is(settings.dist, devConfig.publish)
})

test('serverSettings: set "framework" to "#custom" but no "command"', async t => {
  const devConfig = { framework: '#custom', targetPort: 3000, publish: sitePath }
  await t.throwsAsync(async () => {
     await serverSettings(devConfig, {}, sitePath,  () => {})
  }, /"command" and "targetPort" properties are required when "framework" is set to "#custom"/)
})

test('serverSettings: set "framework" to "#custom" but no "targetPort"', async t => {
  const devConfig = { framework: '#custom', command: "npm run dev", publish: sitePath }
  await t.throwsAsync(async () => {
     await serverSettings(devConfig, {}, sitePath,  () => {})
  }, /"command" and "targetPort" properties are required when "framework" is set to "#custom"/)
})

test('serverSettings: set "framework" to "#custom" but no "targetPort" or "command"', async t => {
  const devConfig = { framework: '#custom', publish: sitePath }
  await t.throwsAsync(async () => {
     await serverSettings(devConfig, {}, sitePath, () => {})
  }, /"command" and "targetPort" properties are required when "framework" is set to "#custom"/)
})

test('serverSettings: "functions" config', async t => {
  const devConfig = { framework: '#auto', functions: path.join(sitePath, 'functions') }
  const settings = await serverSettings(devConfig, {}, sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
})

test('serverSettings: "dir" flag', async t => {
  const devConfig = { framework: '#auto', publish: path.join(sitePath, 'build'), functions: path.join(sitePath, 'functions') }
  const flags = { dir: sitePath }
  const settings = await serverSettings(devConfig, flags, sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
  t.is(settings.dist, flags.dir)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.is(settings.noCmd, true)
})

test('serverSettings: "dir" flag with "targetPort"', async t => {
  const devConfig = { framework: '#auto', targetPort: 1234, functions: path.join(sitePath, 'functions') }
  const flags = { dir: sitePath }
  await t.throwsAsync(async () => {
    await serverSettings(devConfig, flags, sitePath, () => {})
  }, /"command" or "targetPort" options cannot be used in conjunction with "dir" flag/)
})

test('serverSettings: when no framework is detected', async t => {
  const devConfig = { framework: '#auto', publish: path.join(sitePath, 'build'), functions: path.join(sitePath, 'functions') }
  const settings = await serverSettings(devConfig, {}, sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
  t.is(settings.dist, devConfig.publish)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.is(settings.noCmd, true)
})


test('serverSettings: no config', async t => {
  const devConfig = { framework: '#auto' }
  const settings = await serverSettings(devConfig, {}, sitePath, () => {})
  t.is(settings.dist, sitePath)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.truthy(settings.port)
  t.truthy(settings.proxyPort)
  t.is(settings.noCmd, true)
})

test('chooseDefaultArgs', t => {
  const possibleArgsArrs = [['run', 'dev'], ['run develop']]
  const args = chooseDefaultArgs(possibleArgsArrs)
  t.deepEqual(args, possibleArgsArrs[0])
})
