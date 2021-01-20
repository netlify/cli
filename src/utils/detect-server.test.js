const path = require('path')
const process = require('process')

const test = require('ava')
const getPort = require('get-port')

const { createSiteBuilder } = require('../../tests/utils/site-builder')

const { loadDetector, serverSettings, chooseDefaultArgs } = require('./detect-server')

const TARGET_PORT = 1234
const CUSTOM_PORT = 3000

test.before(async (t) => {
  const builder = createSiteBuilder({ siteName: 'site-for-detecting-server' })
  await builder.buildAsync()

  t.context.cwd = process.cwd()

  process.chdir(builder.directory)

  t.context.builder = builder
  t.context.sitePath = builder.directory
})

test.after(async (t) => {
  process.chdir(t.context.cwd)
  await t.context.builder.cleanupAsync()
})

test('loadDetector: valid', (t) => {
  const detector = loadDetector('create-react-app.js')
  t.is(typeof detector, 'function')
})

test('loadDetector: invalid', (t) => {
  t.throws(
    () => {
      loadDetector('cry.js')
    },
    { message: /Failed to load detector/ },
  )
})

test('serverSettings: minimal config', async (t) => {
  const settings = await serverSettings({ framework: '#auto' }, {}, t.context.sitePath, () => {})
  t.is(settings.framework, undefined)
})

test('serverSettings: "#static" as "framework"', async (t) => {
  const settings = await serverSettings({ framework: '#static' }, {}, t.context.sitePath, () => {})
  t.is(settings.framework, undefined)
})

test('serverSettings: throw if "port" not available', async (t) => {
  const port = await getPort({ port: 1 })
  await t.throwsAsync(
    serverSettings({ framework: '#auto', port }, {}, t.context.sitePath, () => {}),
    { message: /Could not acquire required "port"/ },
  )
})

test('serverSettings: "command" override npm', async (t) => {
  const devConfig = { framework: '#custom', command: 'npm run dev', targetPort: TARGET_PORT }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
})

test('serverSettings: "command" override yarn', async (t) => {
  const devConfig = { framework: '#custom', command: 'yarn dev', targetPort: TARGET_PORT }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
})

test('serverSettings: custom framework parameters', async (t) => {
  const devConfig = { framework: '#custom', command: 'yarn dev', targetPort: CUSTOM_PORT, publish: t.context.sitePath }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.framework, '#custom')
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.is(settings.targetPort, devConfig.frameworkPort)
  t.is(settings.dist, devConfig.publish)
})

test('serverSettings: set "framework" to "#custom" but no "command"', async (t) => {
  const devConfig = { framework: '#custom', targetPort: CUSTOM_PORT, publish: t.context.sitePath }
  await t.throwsAsync(
    serverSettings(devConfig, {}, t.context.sitePath, () => {}),
    { message: /"command" and "targetPort" properties are required when "framework" is set to "#custom"/ },
  )
})

test('serverSettings: set "framework" to "#custom" but no "targetPort"', async (t) => {
  const devConfig = { framework: '#custom', command: 'npm run dev', publish: t.context.sitePath }
  await t.throwsAsync(
    serverSettings(devConfig, {}, t.context.sitePath, () => {}),
    { message: /"command" and "targetPort" properties are required when "framework" is set to "#custom"/ },
  )
})

test('serverSettings: set "framework" to "#custom" but no "targetPort" or "command"', async (t) => {
  const devConfig = { framework: '#custom', publish: t.context.sitePath }
  await t.throwsAsync(
    serverSettings(devConfig, {}, t.context.sitePath, () => {}),
    { message: /"command" and "targetPort" properties are required when "framework" is set to "#custom"/ },
  )
})

test('serverSettings: "functions" config', async (t) => {
  const devConfig = { framework: '#auto', functions: path.join(t.context.sitePath, 'functions') }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
})

test('serverSettings: "dir" flag', async (t) => {
  const devConfig = {
    framework: '#auto',
    publish: path.join(t.context.sitePath, 'build'),
    functions: path.join(t.context.sitePath, 'functions'),
  }
  const flags = { dir: t.context.sitePath }
  const settings = await serverSettings(devConfig, flags, t.context.sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
  t.is(settings.dist, flags.dir)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.is(settings.noCmd, true)
})

test('serverSettings: "dir" flag and "command" as config param', async (t) => {
  const devConfig = {
    framework: '#auto',
    command: 'npm start',
    publish: path.join(t.context.sitePath, 'build'),
    functions: path.join(t.context.sitePath, 'functions'),
  }
  const flags = { dir: t.context.sitePath }
  const settings = await serverSettings(devConfig, flags, t.context.sitePath, () => {})
  t.is(settings.command, undefined)
  t.is(settings.noCmd, true)
  t.is(settings.dist, flags.dir)
})

test('serverSettings: "dir" and "targetPort" flags', async (t) => {
  const devConfig = { framework: '#auto', functions: path.join(t.context.sitePath, 'functions') }
  const flags = { dir: t.context.sitePath, targetPort: TARGET_PORT }
  await t.throwsAsync(
    serverSettings(devConfig, flags, t.context.sitePath, () => {}),
    { message: /"targetPort" option cannot be used in conjunction with "dir" flag/ },
  )
})

test('serverSettings: "dir" and "command" flags', async (t) => {
  const devConfig = { framework: '#auto', functions: path.join(t.context.sitePath, 'functions') }
  const flags = { dir: t.context.sitePath, command: 'ding' }
  await t.throwsAsync(
    serverSettings(devConfig, flags, t.context.sitePath, () => {}),
    { message: /"command" option cannot be used in conjunction with "dir" flag/ },
  )
})

test('serverSettings: when no framework is detected', async (t) => {
  const devConfig = {
    framework: '#auto',
    publish: path.join(t.context.sitePath, 'build'),
    functions: path.join(t.context.sitePath, 'functions'),
  }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
  t.is(settings.dist, devConfig.publish)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.is(settings.noCmd, true)
})

test('serverSettings: no config', async (t) => {
  const devConfig = { framework: '#auto' }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.dist, t.context.sitePath)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.truthy(settings.port)
  t.truthy(settings.frameworkPort)
  t.is(settings.noCmd, true)
})

test('chooseDefaultArgs', (t) => {
  const possibleArgsArrs = [['run', 'dev'], ['run develop']]
  const args = chooseDefaultArgs(possibleArgsArrs)
  t.deepEqual(args, possibleArgsArrs[0])
})
