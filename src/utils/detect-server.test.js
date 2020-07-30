const test = require('ava')
const path = require('path')
const getPort = require('get-port')
const { loadDetector, serverSettings, chooseDefaultArgs } = require('./detect-server')
const { createSiteBuilder } = require('../../tests/utils/siteBuilder')

test.before(async t => {
  const builder = createSiteBuilder({ siteName: 'site-for-detecting-server' })
  await builder.buildAsync()

  t.context.cwd = process.cwd()

  process.chdir(builder.directory)

  t.context.builder = builder
  t.context.sitePath = builder.directory
})

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
  const settings = await serverSettings({ framework: '#auto' }, {}, t.context.sitePath, () => {})
  t.is(settings.framework, undefined)
})

test('serverSettings: "#static" as "framework"', async t => {
  const settings = await serverSettings({ framework: '#static' }, {}, t.context.sitePath, () => {})
  t.is(settings.framework, undefined)
})

test('serverSettings: throw if "port" not available', async t => {
  const port = await getPort({ port: 1 })
  await t.throwsAsync(async () => {
    await serverSettings({ framework: '#auto', port }, {}, t.context.sitePath, () => {})
  }, /Could not acquire required "port"/)
})

test('serverSettings: "command" override npm', async t => {
  const devConfig = { framework: '#custom', command: 'npm run dev', targetPort: 1234 }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
})

test('serverSettings: "command" override yarn', async t => {
  const devConfig = { framework: '#custom', command: 'yarn dev', targetPort: 1234 }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.framework, devConfig.framework)
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
})

test('serverSettings: custom framework parameters', async t => {
  const devConfig = { framework: '#custom', command: 'yarn dev', targetPort: 3000, publish: t.context.sitePath }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.framework, '#custom')
  t.is(settings.command, devConfig.command.split(' ')[0])
  t.deepEqual(settings.args, devConfig.command.split(' ').slice(1))
  t.is(settings.targetPort, devConfig.frameworkPort)
  t.is(settings.dist, devConfig.publish)
})

test('serverSettings: set "framework" to "#custom" but no "command"', async t => {
  const devConfig = { framework: '#custom', targetPort: 3000, publish: t.context.sitePath }
  await t.throwsAsync(async () => {
    await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  }, /"command" and "targetPort" properties are required when "framework" is set to "#custom"/)
})

test('serverSettings: set "framework" to "#custom" but no "targetPort"', async t => {
  const devConfig = { framework: '#custom', command: 'npm run dev', publish: t.context.sitePath }
  await t.throwsAsync(async () => {
    await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  }, /"command" and "targetPort" properties are required when "framework" is set to "#custom"/)
})

test('serverSettings: set "framework" to "#custom" but no "targetPort" or "command"', async t => {
  const devConfig = { framework: '#custom', publish: t.context.sitePath }
  await t.throwsAsync(async () => {
    await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  }, /"command" and "targetPort" properties are required when "framework" is set to "#custom"/)
})

test('serverSettings: "functions" config', async t => {
  const devConfig = { framework: '#auto', functions: path.join(t.context.sitePath, 'functions') }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.functions, devConfig.functions)
})

test('serverSettings: "dir" flag', async t => {
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

test('serverSettings: "dir" flag and "command" as config param', async t => {
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

test('serverSettings: "dir" and "targetPort" flags', async t => {
  const devConfig = { framework: '#auto', functions: path.join(t.context.sitePath, 'functions') }
  const flags = { dir: t.context.sitePath, targetPort: 1234 }
  await t.throwsAsync(async () => {
    await serverSettings(devConfig, flags, t.context.sitePath, () => {})
  }, /"targetPort" option cannot be used in conjunction with "dir" flag/)
})

test('serverSettings: "dir" and "command" flags', async t => {
  const devConfig = { framework: '#auto', functions: path.join(t.context.sitePath, 'functions') }
  const flags = { dir: t.context.sitePath, command: 'ding' }
  await t.throwsAsync(async () => {
    await serverSettings(devConfig, flags, t.context.sitePath, () => {})
  }, /"command" option cannot be used in conjunction with "dir" flag/)
})

test('serverSettings: when no framework is detected', async t => {
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

test('serverSettings: no config', async t => {
  const devConfig = { framework: '#auto' }
  const settings = await serverSettings(devConfig, {}, t.context.sitePath, () => {})
  t.is(settings.dist, t.context.sitePath)
  t.is(settings.framework, undefined)
  t.is(settings.cmd, undefined)
  t.truthy(settings.port)
  t.truthy(settings.frameworkPort)
  t.is(settings.noCmd, true)
})

test('chooseDefaultArgs', t => {
  const possibleArgsArrs = [['run', 'dev'], ['run develop']]
  const args = chooseDefaultArgs(possibleArgsArrs)
  t.deepEqual(args, possibleArgsArrs[0])
})

test.after(async t => {
  process.chdir(t.context.cwd)
  await t.context.builder.cleanupAsync()
})
