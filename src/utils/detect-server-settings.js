// @ts-check
const { EOL } = require('os')
const path = require('path')
const process = require('process')

const frameworkInfoPromise = import('@netlify/framework-info')
const fuzzy = require('fuzzy')
const getPort = require('get-port')
const isPlainObject = require('is-plain-obj')

const { readFileAsyncCatchError } = require('../lib/fs')

const { NETLIFYDEVWARN, chalk, log } = require('./command-helpers')
const { acquirePort } = require('./dev')
const { getInternalFunctionsDir } = require('./functions')

const formatProperty = (str) => chalk.magenta(`'${str}'`)
const formatValue = (str) => chalk.green(`'${str}'`)

const readHttpsSettings = async (options) => {
  if (!isPlainObject(options)) {
    throw new TypeError(
      `https options should be an object with ${formatProperty('keyFile')} and ${formatProperty(
        'certFile',
      )} string properties`,
    )
  }

  const { certFile, keyFile } = options
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

  return { key, cert, keyFilePath: path.resolve(keyFile), certFilePath: path.resolve(certFile) }
}

const validateStringProperty = ({ devConfig, property }) => {
  if (devConfig[property] && typeof devConfig[property] !== 'string') {
    const formattedProperty = formatProperty(property)
    throw new TypeError(
      `Invalid ${formattedProperty} option provided in config. The value of ${formattedProperty} option must be a string`,
    )
  }
}

const validateNumberProperty = ({ devConfig, property }) => {
  if (devConfig[property] && typeof devConfig[property] !== 'number') {
    const formattedProperty = formatProperty(property)
    throw new TypeError(
      `Invalid ${formattedProperty} option provided in config. The value of ${formattedProperty} option must be an integer`,
    )
  }
}

const validateFrameworkConfig = ({ devConfig }) => {
  validateStringProperty({ devConfig, property: 'command' })
  validateNumberProperty({ devConfig, property: 'port' })
  validateNumberProperty({ devConfig, property: 'targetPort' })

  if (devConfig.targetPort && devConfig.targetPort === devConfig.port) {
    throw new Error(
      `${formatProperty('port')} and ${formatProperty(
        'targetPort',
      )} options cannot have same values. Please consult the documentation for more details: https://cli.netlify.com/netlify-dev#netlifytoml-dev-block`,
    )
  }
}

const validateConfiguredPort = ({ detectedPort, devConfig }) => {
  if (devConfig.port && devConfig.port === detectedPort) {
    const formattedPort = formatProperty('port')
    throw new Error(
      `The ${formattedPort} option you specified conflicts with the port of your application. Please use a different value for ${formattedPort}`,
    )
  }
}

const DEFAULT_PORT = 8888
const DEFAULT_STATIC_PORT = 3999

const getDefaultDist = () => {
  log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from. Using current working directory`)
  log(`${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`)
  log(`${NETLIFYDEVWARN} See docs at: https://cli.netlify.com/netlify-dev#project-detection`)
  return process.cwd()
}

const getStaticServerPort = async ({ devConfig }) => {
  const port = await acquirePort({
    configuredPort: devConfig.staticServerPort,
    defaultPort: DEFAULT_STATIC_PORT,
    errorMessage: 'Could not acquire configured static server port',
  })

  return port
}

/**
 *
 * @param {object} param0
 * @param {import('../commands/dev/types').DevConfig} param0.devConfig
 * @param {import('commander').OptionValues} param0.options
 * @param {string} param0.projectDir
 * @returns {Promise<import('./types').BaseServerSettings>}
 */
const handleStaticServer = async ({ devConfig, options, projectDir }) => {
  validateNumberProperty({ devConfig, property: 'staticServerPort' })

  if (options.dir) {
    log(`${NETLIFYDEVWARN} Using simple static server because ${formatProperty('--dir')} flag was specified`)
  } else if (devConfig.framework === '#static') {
    log(
      `${NETLIFYDEVWARN} Using simple static server because ${formatProperty(
        '[dev.framework]',
      )} was set to ${formatValue('#static')}`,
    )
  }

  if (devConfig.targetPort) {
    log(
      `${NETLIFYDEVWARN} Ignoring ${formatProperty(
        'targetPort',
      )} setting since using a simple static server.${EOL}${NETLIFYDEVWARN} Use --staticServerPort or [dev.staticServerPort] to configure the static server port`,
    )
  }

  const dist = options.dir || devConfig.publish || getDefaultDist()
  log(`${NETLIFYDEVWARN} Running static server from "${path.relative(path.dirname(projectDir), dist)}"`)

  const frameworkPort = await getStaticServerPort({ devConfig })
  return {
    ...(devConfig.command && { command: devConfig.command }),
    useStaticServer: true,
    frameworkPort,
    dist,
  }
}

/**
 * Retrieves the settings from a framework
 * @param {import('./types').FrameworkInfo} framework
 * @returns {import('./types').BaseServerSettings}
 */
const getSettingsFromFramework = (framework) => {
  const {
    build: { directory: dist },
    dev: {
      commands: [command],
      port: frameworkPort,
      pollingStrategies = [],
    },
    name: frameworkName,
    staticAssetsDirectory: staticDir,
    env = {},
  } = framework

  return {
    command,
    frameworkPort,
    dist: staticDir || dist,
    framework: frameworkName,
    env,
    pollingStrategies: pollingStrategies.map(({ name }) => name),
  }
}

const hasDevCommand = (framework) => Array.isArray(framework.dev.commands) && framework.dev.commands.length !== 0

const detectFrameworkSettings = async ({ projectDir }) => {
  const { listFrameworks } = await frameworkInfoPromise
  const projectFrameworks = await listFrameworks({ projectDir })
  const frameworks = projectFrameworks.filter((framework) => hasDevCommand(framework))

  if (frameworks.length === 1) {
    return getSettingsFromFramework(frameworks[0])
  }

  if (frameworks.length > 1) {
    // performance optimization, load inquirer on demand
    // eslint-disable-next-line n/global-require
    const inquirer = require('inquirer')
    // eslint-disable-next-line n/global-require
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
      `Add ${formatProperty(
        `framework = "${chosenFramework.id}"`,
      )} to the [dev] section of your netlify.toml to avoid this selection prompt next time`,
    )

    return getSettingsFromFramework(chosenFramework)
  }
}

const hasCommandAndTargetPort = ({ devConfig }) => devConfig.command && devConfig.targetPort

/**
 * Creates settings for the custom framework
 * @param {*} param0
 * @returns {import('./types').BaseServerSettings}
 */
const handleCustomFramework = ({ devConfig }) => {
  if (!hasCommandAndTargetPort({ devConfig })) {
    throw new Error(
      `${formatProperty('command')} and ${formatProperty('targetPort')} properties are required when ${formatProperty(
        'framework',
      )} is set to ${formatValue('#custom')}`,
    )
  }
  return {
    command: devConfig.command,
    frameworkPort: devConfig.targetPort,
    dist: devConfig.publish || getDefaultDist(),
    framework: '#custom',
    pollingStrategies: devConfig.pollingStrategies || [],
  }
}

const mergeSettings = async ({ devConfig, frameworkSettings = {} }) => {
  const {
    command: frameworkCommand,
    frameworkPort: frameworkDetectedPort,
    dist,
    framework,
    env,
    pollingStrategies = [],
  } = frameworkSettings

  const command = devConfig.command || frameworkCommand
  const frameworkPort = devConfig.targetPort || frameworkDetectedPort
  // if the framework doesn't start a server, we use a static one
  const useStaticServer = !(command && frameworkPort)
  return {
    command,
    frameworkPort: useStaticServer ? await getStaticServerPort({ devConfig }) : frameworkPort,
    dist: devConfig.publish || dist || getDefaultDist(),
    framework,
    env,
    pollingStrategies,
    useStaticServer,
  }
}

/**
 * Handles a forced framework and retrieves the settings for it
 * @param {*} param0
 * @returns {Promise<import('./types').BaseServerSettings>}
 */
const handleForcedFramework = async ({ devConfig, projectDir }) => {
  // this throws if `devConfig.framework` is not a supported framework
  const { getFramework } = await frameworkInfoPromise
  const frameworkSettings = getSettingsFromFramework(await getFramework(devConfig.framework, { projectDir }))
  return mergeSettings({ devConfig, frameworkSettings })
}

/**
 * Get the server settings based on the flags and the devConfig
 * @param {import('../commands/dev/types').DevConfig} devConfig
 * @param {import('commander').OptionValues} options
 * @param {string} projectDir
 * @returns {Promise<import('./types').ServerSettings>}
 */
const detectServerSettings = async (devConfig, options, projectDir) => {
  validateStringProperty({ devConfig, property: 'framework' })

  /** @type {Partial<import('./types').BaseServerSettings>} */
  let settings = {}

  if (options.dir || devConfig.framework === '#static') {
    // serving files statically without a framework server
    settings = await handleStaticServer({ options, devConfig, projectDir })
  } else if (devConfig.framework === '#auto') {
    // this is the default CLI behavior

    const runDetection = !hasCommandAndTargetPort({ devConfig })
    const frameworkSettings = runDetection ? await detectFrameworkSettings({ projectDir }) : undefined

    if (frameworkSettings === undefined && runDetection) {
      log(`${NETLIFYDEVWARN} No app server detected. Using simple static server`)
      settings = await handleStaticServer({ options, devConfig, projectDir })
    } else {
      validateFrameworkConfig({ devConfig })
      settings = await mergeSettings({ devConfig, frameworkSettings })
    }
  } else if (devConfig.framework === '#custom') {
    validateFrameworkConfig({ devConfig })
    // when the users wants to configure `command` and `targetPort`
    settings = handleCustomFramework({ devConfig })
  } else if (devConfig.framework) {
    validateFrameworkConfig({ devConfig })
    // this is when the user explicitly configures a framework, e.g. `framework = "gatsby"`
    settings = await handleForcedFramework({ devConfig, projectDir })
  }

  validateConfiguredPort({ devConfig, detectedPort: settings.frameworkPort })

  const acquiredPort = await acquirePort({
    configuredPort: devConfig.port,
    defaultPort: DEFAULT_PORT,
    errorMessage: `Could not acquire required ${formatProperty('port')}`,
  })
  const functionsDir = devConfig.functions || settings.functions
  const internalFunctionsDir = await getInternalFunctionsDir({ base: projectDir })
  const shouldStartFunctionsServer = Boolean(functionsDir || internalFunctionsDir)

  return {
    ...settings,
    port: acquiredPort,
    jwtSecret: devConfig.jwtSecret || 'secret',
    jwtRolePath: devConfig.jwtRolePath || 'app_metadata.authorization.roles',
    functions: functionsDir,
    ...(shouldStartFunctionsServer && { functionsPort: await getPort({ port: devConfig.functionsPort || 0 }) }),
    ...(devConfig.https && { https: await readHttpsSettings(devConfig.https) }),
  }
}

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
  const formattedArr = frameworks.map((framework) =>
    framework.dev.commands.map((command) => ({
      name: `[${chalk.yellow(framework.name)}] '${command}'`,
      value: { ...framework, commands: [command] },
      short: `${framework.name}-${command}`,
    })),
  )
  return formattedArr.flat()
}

module.exports = {
  detectServerSettings,
}
