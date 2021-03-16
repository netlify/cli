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

const serverSettings = async (devConfig, flags, projectDir, log) => {
  if (typeof devConfig.framework !== 'string') {
    throw new TypeError('Invalid "framework" option provided in config')
  }

  let settings = {}

  if (flags.dir) {
    settings = await getStaticServerSettings(settings, flags, projectDir, log)
  } else if (devConfig.framework === '#auto' && !(devConfig.command && devConfig.targetPort)) {
    const frameworks = await listFrameworks({ projectDir })
    if (frameworks.length === 1) {
      const [framework] = frameworks
      settings = { ...settings, ...getSettingsFromFramework(framework) }
    } else if (frameworks.length > 1) {
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
      // finally! we have a selected option
      settings = { ...settings, ...getSettingsFromFramework(chosenFramework) }
      log(
        `Add \`framework = "${chosenFramework.name}"\` to [dev] section of your netlify.toml to avoid this selection prompt next time`,
      )
    }
  } else if (devConfig.framework === '#custom' || (devConfig.command && devConfig.targetPort)) {
    settings.framework = '#custom'
    if (
      devConfig.framework &&
      !['command', 'targetPort'].every((property) => Object.prototype.hasOwnProperty.call(devConfig, property))
    ) {
      throw new Error('"command" and "targetPort" properties are required when "framework" is set to "#custom"')
    }
    if (devConfig.framework !== '#custom' && devConfig.command && devConfig.targetPort) {
      throw new Error(
        '"framework" option must be set to "#custom" when specifying both "command" and "targetPort" options',
      )
    }
  } else if (devConfig.framework === '#static') {
    // Do nothing
  } else {
    const hasConfigFramework = await hasFramework(devConfig.framework, { projectDir })

    if (!hasConfigFramework) {
      throw new Error(
        `Specified "framework" detector "${devConfig.framework}" did not pass requirements for your project`,
      )
    }

    const framework = await getFramework(devConfig.framework, { projectDir })
    settings = { ...settings, ...getSettingsFromFramework(framework) }
  }

  if (!settings.noCmd && devConfig.command) {
    console.log(
      `${NETLIFYDEVLOG} Overriding ${chalk.yellow('command')} with setting derived from netlify.toml [dev] block: ${
        devConfig.command
      }`,
    )
    settings.command = devConfig.command
  }

  settings.dist = flags.dir || devConfig.publish || settings.dist

  if (devConfig.targetPort) {
    if (devConfig.targetPort && typeof devConfig.targetPort !== 'number') {
      throw new Error('Invalid "targetPort" option specified. The value of "targetPort" option must be an integer')
    }

    if (devConfig.targetPort === devConfig.port) {
      throw new Error(
        '"port" and "targetPort" options cannot have same values. Please consult the documentation for more details: https://cli.netlify.com/netlify-dev#netlifytoml-dev-block',
      )
    }

    if (!settings.command)
      throw new Error(
        'No "command" specified or detected. The "command" option is required to use "targetPort" option.',
      )
    if (flags.dir)
      throw new Error(
        '"targetPort" option cannot be used in conjunction with "dir" flag which is used to run a static server.',
      )

    settings.frameworkPort = devConfig.targetPort
  }
  if (devConfig.port && devConfig.port === settings.frameworkPort) {
    throw new Error(
      'The "port" option you specified conflicts with the port of your application. Please use a different value for "port"',
    )
  }

  if (!settings.command && !settings.framework && !settings.noCmd) {
    settings = await getStaticServerSettings(settings, flags, projectDir, log)
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

const getStaticServerSettings = async function (settings, flags, projectDir, log) {
  let { dist } = settings
  if (flags.dir) {
    log(`${NETLIFYDEVWARN} Using simple static server because --dir flag was specified`)
    dist = flags.dir
  } else {
    log(`${NETLIFYDEVWARN} No app server detected and no "command" specified`)
  }
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
    frameworkPort: await getPort({ port: flags.staticServerPort || DEFAULT_STATIC_PORT }),
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
