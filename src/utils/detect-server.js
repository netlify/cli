const { EOL } = require('os')
const path = require('path')
const process = require('process')

const { listFrameworks, hasFramework, getFramework } = require('@netlify/framework-info')
const chalk = require('chalk')
const fuzzy = require('fuzzy')
const getPort = require('get-port')
const isPlainObject = require('is-plain-obj')

const { readFileAsyncCatchError } = require('../lib/fs')

const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./logo')

const readHttpsSettings = async (options) => {
  if (!isPlainObject(options)) {
    throw new TypeError(`https options should be an object with 'keyFile' and 'certFile' string properties`)
  }

  const { keyFile, certFile } = options
  if (typeof keyFile !== 'string') {
    throw new TypeError(`Private key file configuration should be a string`)
  }
  if (typeof certFile !== 'string') {
    throw new TypeError(`Certificate file configuration should be a string`)
  }

  const [{ content: key, error: keyError }, { content: cert, error: certError }] = await Promise.all([
    readFileAsyncCatchError(keyFile),
    readFileAsyncCatchError(certFile),
  ])

  if (keyError) {
    throw new Error(`Error reading private key file: ${keyError.message}`)
  }
  if (certError) {
    throw new Error(`Error reading certificate file: ${certError.message}`)
  }

  return { key, cert }
}

const handleStaticServer = async ({ flags, log, devConfig, projectDir }) => {
  if (flags.dir) {
    log(`${NETLIFYDEVWARN} Using simple static server because --dir flag was specified`)
  } else {
    log(`${NETLIFYDEVWARN} Using simple static server because [dev.framework] was set to #static`)
  }
  if (devConfig.targetPort) {
    log(
      `${NETLIFYDEVWARN} Ignoring targetPort setting since using a simple static server.${EOL}Use --staticServerPort or [dev.staticServerPort] to configure the static server port`,
    )
  }
  if (devConfig.command) {
    log(`${NETLIFYDEVWARN} Ignoring command setting since using a simple static server`)
  }
  const { noCmd, frameworkPort, dist } = await getStaticServerSettings({
    dist: flags.dir || devConfig.publish,
    port: flags.staticServerPort || devConfig.staticServerPort,
    projectDir,
    log,
  })
  return { noCmd, frameworkPort, dist }
}

const getSettingsFromFramework = (framework) => {
  const {
    build: { directory: dist },
    dev: {
      commands: [command],
      port: frameworkPort,
    },
    name: frameworkName,
    staticAssetsDirectory: staticDir,
    env,
  } = framework

  return { command, frameworkPort, dist: staticDir || dist, framework: frameworkName, env }
}

const detectFrameworkSettings = async ({ projectDir, log }) => {
  const frameworks = await listFrameworks({ projectDir })

  if (frameworks.length === 1) {
    return getSettingsFromFramework(frameworks[0])
  }

  if (frameworks.length > 1) {
    // performance optimization, load inquirer on demand
    // eslint-disable-next-line node/global-require
    const inquirer = require('inquirer')
    // eslint-disable-next-line node/global-require
    const inquirerAutocompletePrompt = require('inquirer-autocomplete-prompt')
    /** multiple matching detectors, make the user choose */
    inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)
    const scriptInquirerOptions = formatSettingsArrForInquirer(frameworks)
    const { chosenFramework } = await inquirer.prompt({
      name: 'chosenFramework',
      message: `Multiple possible start commands found`,
      type: 'autocomplete',
      source(_, input) {
        if (!input || input === '') {
          return scriptInquirerOptions
        }
        // only show filtered results
        return filterSettings(scriptInquirerOptions, input)
      },
    })
    log(
      `Add \`framework = "${chosenFramework.name}"\` to [dev] section of your netlify.toml to avoid this selection prompt next time`,
    )

    return getSettingsFromFramework(chosenFramework)
  }

  return {}
}

const handleCustomFramework = ({ devConfig }) => {
  if (!devConfig.command || !devConfig.targetPort) {
    throw new Error('"command" and "targetPort" properties are required when "framework" is set to "#custom"')
  }
  return {
    command: devConfig.command,
    frameworkPort: devConfig.targetPort,
    dist: devConfig.publish,
    framework: '#custom',
  }
}

const handleForcedFramework = async ({ devConfig, projectDir }) => {
  try {
    const hasConfigFramework = await hasFramework(devConfig.framework, { projectDir })
    if (!hasConfigFramework) {
      throw new Error(`Specified "framework" "${devConfig.framework}" did not pass requirements for your project`)
    }
  } catch (error) {
    // this can happen when the framework info library doesn't support detecting devConfig.framework
    throw new Error(
      `Unsupported "framework" "${devConfig.framework}". Please set [dev.framework] to #custom and configure 'command' and 'targetPort'`,
    )
  }
  const { command, frameworkPort, dist, framework, env } = getSettingsFromFramework(
    await getFramework(devConfig.framework, { projectDir }),
  )
  return {
    command: devConfig.command || command,
    frameworkPort: devConfig.targetPort || frameworkPort,
    dist: devConfig.publish || dist,
    framework,
    env,
  }
}

const serverSettings = async (devConfig, flags, projectDir, log) => {
  if (typeof devConfig.framework !== 'string') {
    throw new TypeError('Invalid "framework" option provided in config')
  }

  if (devConfig.targetPort && typeof devConfig.targetPort !== 'number') {
    throw new TypeError('Invalid "targetPort" option specified. The value of "targetPort" option must be an integer')
  }

  if (devConfig.targetPort && typeof devConfig.targetPort !== 'number') {
    throw new TypeError('Invalid "targetPort" option specified. The value of "targetPort" option must be an integer')
  }

  let settings = {}

  if (flags.dir || devConfig.framework === '#static') {
    // serving files statically without a framework server
    settings = await handleStaticServer({ flags, log, devConfig, projectDir })
  } else if (devConfig.framework === '#auto') {
    // this is the default CLI behavior
    const { command, frameworkPort, dist, framework, env } = await detectFrameworkSettings({ projectDir, log })
    settings = {
      command: devConfig.command || command,
      frameworkPort: devConfig.targetPort || frameworkPort,
      dist: devConfig.publish || dist,
      framework,
      env,
    }
  } else if (devConfig.framework === '#custom') {
    // when the users wants to configure `command` and `targetPort`
    settings = handleCustomFramework({ devConfig })
  } else if (devConfig.framework) {
    // this is when the user explicitly configures a framework, e.g. `framework = "gatsby"`
    settings = await handleForcedFramework({ devConfig, projectDir })
  }

  if (devConfig.targetPort) {
    if (devConfig.targetPort === devConfig.port) {
      throw new Error(
        '"port" and "targetPort" options cannot have same values. Please consult the documentation for more details: https://cli.netlify.com/netlify-dev#netlifytoml-dev-block',
      )
    }

    if (!settings.command) {
      throw new Error(
        'No "command" specified or detected. The "command" option is required to use "targetPort" option.',
      )
    }
  }

  if (devConfig.port && devConfig.port === settings.frameworkPort) {
    throw new Error(
      'The "port" option you specified conflicts with the port of your application. Please use a different value for "port"',
    )
  }

  if (!settings.command && !settings.framework && !settings.noCmd) {
    log(`${NETLIFYDEVWARN} No app server detected and no "command" specified`)
    settings = await getStaticServerSettings({ dist: settings.dist, port: flags.staticServerPort, projectDir, log })
  }

  if (!settings.frameworkPort) throw new Error('No "targetPort" option specified or detected.')

  if (devConfig.port && typeof devConfig.port !== 'number') {
    throw new Error('Invalid "port" option specified. The value of "port" option must be an integer')
  }

  if (devConfig.port && devConfig.port === settings.frameworkPort) {
    throw new Error(
      'The "port" option you specified conflicts with the port of your application. Please use a different value for "port"',
    )
  }
  const triedPort = devConfig.port || DEFAULT_PORT
  settings.port = await getPort({ port: triedPort })
  if (triedPort !== settings.port && devConfig.port) {
    throw new Error(`Could not acquire required "port": ${triedPort}`)
  }

  settings.jwtSecret = devConfig.jwtSecret || 'secret'
  settings.jwtRolePath = devConfig.jwtRolePath || 'app_metadata.authorization.roles'
  settings.functions = devConfig.functions || settings.functions
  if (settings.functions) {
    settings.functionsPort = await getPort({ port: devConfig.functionsPort || 0 })
  }
  if (devConfig.https) {
    settings.https = await readHttpsSettings(devConfig.https)
  }

  return settings
}

const DEFAULT_PORT = 8888

const getStaticServerSettings = async function ({ dist, port, projectDir, log }) {
  if (!dist) {
    log(`${NETLIFYDEVLOG} Using current working directory`)
    log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from`)
    log(`${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`)
    log(`${NETLIFYDEVWARN} See docs at: https://cli.netlify.com/netlify-dev#project-detection`)
    dist = process.cwd()
  }

  log(`${NETLIFYDEVWARN} Running static server from "${path.relative(path.dirname(projectDir), dist)}"`)
  return {
    noCmd: true,
    frameworkPort: await getPort({ port: port || DEFAULT_STATIC_PORT }),
    dist,
  }
}

const DEFAULT_STATIC_PORT = 3999

const filterSettings = function (scriptInquirerOptions, input) {
  const filterOptions = scriptInquirerOptions.map((scriptInquirerOption) => scriptInquirerOption.name)
  // TODO: remove once https://github.com/sindresorhus/eslint-plugin-unicorn/issues/1394 is fixed
  // eslint-disable-next-line unicorn/no-array-method-this-argument
  const filteredSettings = fuzzy.filter(input, filterOptions)
  const filteredSettingNames = new Set(
    filteredSettings.map((filteredSetting) => (input ? filteredSetting.string : filteredSetting)),
  )
  return scriptInquirerOptions.filter((t) => filteredSettingNames.has(t.name))
}

const formatSettingsArrForInquirer = function (frameworks) {
  return [].concat(
    ...frameworks.map((framework) =>
      framework.watch.commands.map((command) => ({
        name: `[${chalk.yellow(framework.name)}] ${framework.command} ${command.join(' ')}`,
        value: { ...framework, commands: [command] },
        short: `${framework.name}-${command}`,
      })),
    ),
  )
}

module.exports = {
  serverSettings,
}
