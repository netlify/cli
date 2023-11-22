import { readFile } from 'fs/promises'
import { EOL } from 'os'
import { dirname, relative, resolve } from 'path'

import { getFramework, getSettings } from '@netlify/build-info'
import getPort from 'get-port'

import { detectFrameworkSettings } from './build-info.js'
import { NETLIFYDEVWARN, chalk, log } from './command-helpers.js'
import { acquirePort } from './dev.js'
import { getInternalFunctionsDir } from './functions/functions.js'
import { getPluginsToAutoInstall } from './init/utils.js'

/** @param {string} str */
// @ts-expect-error TS(7006) FIXME: Parameter 'str' implicitly has an 'any' type.
const formatProperty = (str) => chalk.magenta(`'${str}'`)
/** @param {string} str */
// @ts-expect-error TS(7006) FIXME: Parameter 'str' implicitly has an 'any' type.
const formatValue = (str) => chalk.green(`'${str}'`)

/**
 * @param {object} options
 * @param {string} options.keyFile
 * @param {string} options.certFile
 * @returns {Promise<{ key: string, cert: string, keyFilePath: string, certFilePath: string }>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const readHttpsSettings = async (options) => {
  if (typeof options !== 'object' || !options.keyFile || !options.certFile) {
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

  const [key, cert] = await Promise.allSettled([readFile(keyFile, 'utf-8'), readFile(certFile, 'utf-8')])

  if (key.status === 'rejected') {
    throw new Error(`Error reading private key file: ${key.reason}`)
  }
  if (cert.status === 'rejected') {
    throw new Error(`Error reading certificate file: ${cert.reason}`)
  }

  return { key: key.value, cert: cert.value, keyFilePath: resolve(keyFile), certFilePath: resolve(certFile) }
}

/**
 * Validates a property inside the devConfig to be of a given type
 * @param {import('../commands/dev/types.js').DevConfig} devConfig The devConfig
 * @param {keyof import('../commands/dev/types.js').DevConfig} property The property to validate
 * @param {'string' | 'number'} type The type it should have
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'devConfig' implicitly has an 'any' type... Remove this comment to see the full error message
function validateProperty(devConfig, property, type) {
  if (devConfig[property] && typeof devConfig[property] !== type) {
    const formattedProperty = formatProperty(property)
    throw new TypeError(
      `Invalid ${formattedProperty} option provided in config. The value of ${formattedProperty} option must be of type ${type}`,
    )
  }
}

/**
 *
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
const validateFrameworkConfig = ({ devConfig }) => {
  validateProperty(devConfig, 'command', 'string')
  validateProperty(devConfig, 'port', 'number')
  validateProperty(devConfig, 'targetPort', 'number')

  if (devConfig.targetPort && devConfig.targetPort === devConfig.port) {
    throw new Error(
      `${formatProperty('port')} and ${formatProperty(
        'targetPort',
      )} options cannot have same values. Please consult the documentation for more details: https://ntl.fyi/ports-and-netlify-dev`,
    )
  }
}

/**
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 * @param {number=} config.detectedPort
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'detectedPort' implicitly has an '... Remove this comment to see the full error message
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

/**
 * Logs a message that it was unable to determine the dist directory and falls back to the workingDir
 * @param {string} workingDir
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
const getDefaultDist = (workingDir) => {
  log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from. Using current working directory`)
  log(`${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`)
  log(`${NETLIFYDEVWARN} See docs at: https://cli.netlify.com/netlify-dev#project-detection`)
  return workingDir
}

/**
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 * @returns {Promise<number>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
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
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 * @param {import('commander').OptionValues} config.flags
 * @param {string} config.workingDir
 * @returns {Promise<Omit<import('./types.js').BaseServerSettings, 'command'> & {command?: string}>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
const handleStaticServer = async ({ devConfig, flags, workingDir }) => {
  validateProperty(devConfig, 'staticServerPort', 'number')

  if (flags.dir) {
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

  const dist = flags.dir || devConfig.publish || getDefaultDist(workingDir)
  log(`${NETLIFYDEVWARN} Running static server from "${relative(dirname(workingDir), dist)}"`)

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
 * @param {import('@netlify/build-info').Settings} [settings]
 * @returns {import('./types.js').BaseServerSettings | undefined}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'settings' implicitly has an 'any' type.
const getSettingsFromDetectedSettings = (settings) => {
  if (!settings) {
    return
  }
  return {
    baseDirectory: settings.baseDirectory,
    command: settings.devCommand,
    frameworkPort: settings.frameworkPort,
    dist: settings.dist,
    framework: settings.framework.name,
    env: settings.env,
    pollingStrategies: settings.pollingStrategies,
    plugins: getPluginsToAutoInstall(settings.plugins_from_config_file, settings.plugins_recommended),
  }
}

/**
 * @param {import('../commands/dev/types.js').DevConfig} devConfig
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'devConfig' implicitly has an 'any' type... Remove this comment to see the full error message
const hasCommandAndTargetPort = (devConfig) => devConfig.command && devConfig.targetPort

/**
 * Creates settings for the custom framework
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 * @param {string} config.workingDir
 * @returns {import('./types.js').BaseServerSettings}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
const handleCustomFramework = ({ devConfig, workingDir }) => {
  if (!hasCommandAndTargetPort(devConfig)) {
    throw new Error(
      `${formatProperty('command')} and ${formatProperty('targetPort')} properties are required when ${formatProperty(
        'framework',
      )} is set to ${formatValue('#custom')}`,
    )
  }
  return {
    command: devConfig.command,
    frameworkPort: devConfig.targetPort,
    dist: devConfig.publish || getDefaultDist(workingDir),
    framework: '#custom',
    pollingStrategies: devConfig.pollingStrategies || [],
  }
}

/**
 * Merges the framework settings with the devConfig
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 * @param {string} config.workingDir
 * @param {Partial<import('./types.js').BaseServerSettings>=} config.frameworkSettings
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
const mergeSettings = async ({ devConfig, frameworkSettings = {}, workingDir }) => {
  // @ts-expect-error TS(2339) FIXME: Property 'command' does not exist on type '{}'.
  const command = devConfig.command || frameworkSettings.command
  // @ts-expect-error TS(2339) FIXME: Property 'frameworkPort' does not exist on type '{... Remove this comment to see the full error message
  const frameworkPort = devConfig.targetPort || frameworkSettings.frameworkPort
  // if the framework doesn't start a server, we use a static one
  const useStaticServer = !(command && frameworkPort)
  return {
    // @ts-expect-error TS(2339) FIXME: Property 'baseDirectory' does not exist on type '{... Remove this comment to see the full error message
    baseDirectory: devConfig.base || frameworkSettings.baseDirectory,
    command,
    frameworkPort: useStaticServer ? await getStaticServerPort({ devConfig }) : frameworkPort,
    // @ts-expect-error TS(2339) FIXME: Property 'dist' does not exist on type '{}'.
    dist: devConfig.publish || frameworkSettings.dist || getDefaultDist(workingDir),
    // @ts-expect-error TS(2339) FIXME: Property 'framework' does not exist on type '{}'.
    framework: frameworkSettings.framework,
    // @ts-expect-error TS(2339) FIXME: Property 'env' does not exist on type '{}'.
    env: frameworkSettings.env,
    // @ts-expect-error TS(2339) FIXME: Property 'pollingStrategies' does not exist on typ... Remove this comment to see the full error message
    pollingStrategies: frameworkSettings.pollingStrategies || [],
    useStaticServer,
  }
}

/**
 * Handles a forced framework and retrieves the settings for it
 * @param {object} config
 * @param {import('../commands/dev/types.js').DevConfig} config.devConfig
 * @param {import('@netlify/build-info').Project} config.project
 * @param {string} config.workingDir
 * @param {string=} config.workspacePackage
 * @returns {Promise<import('./types.js').BaseServerSettings>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
const handleForcedFramework = async ({ devConfig, project, workingDir, workspacePackage }) => {
  // this throws if `devConfig.framework` is not a supported framework
  const framework = await getFramework(devConfig.framework, project)
  const settings = await getSettings(framework, project, workspacePackage || '')
  const frameworkSettings = getSettingsFromDetectedSettings(settings)
  return mergeSettings({ devConfig, workingDir, frameworkSettings })
}

/**
 * Get the server settings based on the flags and the devConfig
 * @param {import('../commands/dev/types.js').DevConfig} devConfig
 * @param {import('commander').OptionValues} flags
 * @param {import('../commands/base-command.js').default} command
 * @returns {Promise<import('./types.js').ServerSettings>}
 */

// @ts-expect-error TS(7006) FIXME: Parameter 'devConfig' implicitly has an 'any' type... Remove this comment to see the full error message
const detectServerSettings = async (devConfig, flags, command) => {
  validateProperty(devConfig, 'framework', 'string')

  /** @type {Partial<import('./types.js').BaseServerSettings>} */
  let settings = {}

  if (flags.dir || devConfig.framework === '#static') {
    // serving files statically without a framework server
    settings = await handleStaticServer({ flags, devConfig, workingDir: command.workingDir })
  } else if (devConfig.framework === '#auto') {
    // this is the default CLI behavior

    const runDetection = !hasCommandAndTargetPort(devConfig)
    const frameworkSettings = runDetection
      ? getSettingsFromDetectedSettings(await detectFrameworkSettings(command, 'dev'))
      : undefined
    if (frameworkSettings === undefined && runDetection) {
      log(`${NETLIFYDEVWARN} No app server detected. Using simple static server`)
      settings = await handleStaticServer({ flags, devConfig, workingDir: command.workingDir })
    } else {
      validateFrameworkConfig({ devConfig })

      settings = await mergeSettings({ devConfig, frameworkSettings, workingDir: command.workingDir })
    }

    // @ts-expect-error TS(2339) FIXME: Property 'plugins' does not exist on type '{}'.
    settings.plugins = frameworkSettings?.plugins
  } else if (devConfig.framework === '#custom') {
    validateFrameworkConfig({ devConfig })
    // when the users wants to configure `command` and `targetPort`
    settings = handleCustomFramework({ devConfig, workingDir: command.workingDir })
  } else if (devConfig.framework) {
    validateFrameworkConfig({ devConfig })
    // this is when the user explicitly configures a framework, e.g. `framework = "gatsby"`
    settings = await handleForcedFramework({
      devConfig,
      project: command.project,
      workingDir: command.workingDir,
      workspacePackage: command.workspacePackage,
    })
  }

  // @ts-expect-error TS(2339) FIXME: Property 'frameworkPort' does not exist on type '{... Remove this comment to see the full error message
  validateConfiguredPort({ devConfig, detectedPort: settings.frameworkPort })

  const acquiredPort = await acquirePort({
    configuredPort: devConfig.port,
    defaultPort: DEFAULT_PORT,
    errorMessage: `Could not acquire required ${formatProperty('port')}`,
  })
  // @ts-expect-error TS(2339) FIXME: Property 'functions' does not exist on type '{}'.
  const functionsDir = devConfig.functions || settings.functions
  // @ts-expect-error TS(2345) FIXME: Argument of type '{ base: any; }' is not assignabl... Remove this comment to see the full error message
  const internalFunctionsDir = await getInternalFunctionsDir({ base: command.workingDir })
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

/**
 * Returns a copy of the provided config with any plugins provided by the
 * server settings
 * @param {*} config
 * @param {Partial<import('./types.js').ServerSettings>} settings
 * @returns {*} Modified config
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const getConfigWithPlugins = (config, settings) => {
  if (!settings.plugins) {
    return config
  }

  // If there are plugins that we should be running for this site, add them
  // to the config as if they were declared in netlify.toml. We must check
  // whether the plugin has already been added by another source (like the
  // TOML file or the UI), as we don't want to run the same plugin twice.
  const { plugins: existingPlugins = [] } = config
  // @ts-expect-error TS(7006) FIXME: Parameter 'plugin' implicitly has an 'any' type.
  const existingPluginNames = new Set(existingPlugins.map((plugin) => plugin.package))
  const newPlugins = settings.plugins
    // @ts-expect-error TS(7006) FIXME: Parameter 'pluginName' implicitly has an 'any' typ... Remove this comment to see the full error message
    .map((pluginName) => {
      if (existingPluginNames.has(pluginName)) {
        return
      }

      return { package: pluginName, origin: 'config', inputs: {} }
    })
    .filter(Boolean)

  return {
    ...config,
    plugins: [...newPlugins, ...config.plugins],
  }
}

export default detectServerSettings
