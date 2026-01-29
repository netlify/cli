import { readFile } from 'fs/promises'
import { EOL } from 'os'
import { dirname, relative, resolve } from 'path'

import { Project, Settings, getFramework, getSettings } from '@netlify/build-info'
import type { OptionValues } from 'commander'
import getPort from 'get-port'

import BaseCommand from '../commands/base-command.js'
import { type DevConfig } from '../commands/dev/types.js'

import { detectFrameworkSettings } from './build-info.js'
import { NETLIFYDEVWARN, chalk, log } from './command-helpers.js'
import { acquirePort } from './dev.js'
import { getPluginsToAutoInstall } from './init/utils.js'
import { BaseServerSettings, ServerSettings } from './types.js'
import { CachedConfig } from '../lib/build.js'

const formatProperty = (str: string) => chalk.magenta(`'${str}'`)
const formatValue = (str: string) => chalk.green(`'${str}'`)

const readHttpsSettings = async (options: {
  keyFile: string
  certFile: string
}): Promise<{ key: string; cert: string; keyFilePath: string; certFilePath: string }> => {
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
 */
function validateProperty(devConfig: DevConfig, property: keyof DevConfig, type: 'string' | 'number') {
  if (devConfig[property] && typeof devConfig[property] !== type) {
    const formattedProperty = formatProperty(property)
    throw new TypeError(
      `Invalid ${formattedProperty} option provided in config. The value of ${formattedProperty} option must be of type ${type}`,
    )
  }
}

const validateFrameworkConfig = ({ devConfig }: { devConfig: DevConfig }) => {
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

const validateConfiguredPort = ({ detectedPort, devConfig }: { detectedPort?: number; devConfig: DevConfig }) => {
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
 */
const getDefaultDist = (workingDir: string) => {
  log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from. Using current working directory`)
  log(`${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`)
  log(`${NETLIFYDEVWARN} See docs at: https://docs.netlify.com/cli/local-development/#project-detection`)
  return workingDir
}

const getStaticServerPort = async ({ devConfig }: { devConfig: DevConfig }): Promise<number> => {
  const port = await acquirePort({
    configuredPort: devConfig.staticServerPort,
    defaultPort: DEFAULT_STATIC_PORT,
    errorMessage: 'Could not acquire configured static server port',
  })

  return port
}

const handleStaticServer = async ({
  devConfig,
  flags,
  workingDir,
}: {
  devConfig: DevConfig
  flags: OptionValues
  workingDir: string
}): Promise<Omit<BaseServerSettings, 'command'> & { command?: string }> => {
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
 */
const getSettingsFromDetectedSettings = (command: BaseCommand, settings?: Settings) => {
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
    plugins: getPluginsToAutoInstall(command, settings.plugins_from_config_file, settings.plugins_recommended),
    clearPublishDirectory: settings.clearPublishDirectory,
  }
}

const hasCommandAndTargetPort = (devConfig: DevConfig) => devConfig.command && devConfig.targetPort

/**
 * Creates settings for the custom framework
 */
const handleCustomFramework = ({
  devConfig,
  workingDir,
}: {
  devConfig: DevConfig
  workingDir: string
}): BaseServerSettings => {
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
    pollingStrategies: devConfig.pollingStrategies ?? [],
  }
}

/**
 * Merges the framework settings with the devConfig
 */
const mergeSettings = async ({
  devConfig,
  frameworkSettings,
  workingDir,
}: {
  devConfig: DevConfig
  frameworkSettings?: BaseServerSettings | undefined
  workingDir: string
}) => {
  const command = devConfig.command || frameworkSettings?.command
  const frameworkPort = devConfig.targetPort || frameworkSettings?.frameworkPort
  const useStaticServer = !(command && frameworkPort)

  return {
    baseDirectory: devConfig.base || frameworkSettings?.baseDirectory,
    command,
    frameworkPort: useStaticServer ? await getStaticServerPort({ devConfig }) : frameworkPort,
    dist: devConfig.publish || frameworkSettings?.dist || getDefaultDist(workingDir),
    framework: frameworkSettings?.framework,
    env: frameworkSettings?.env,
    pollingStrategies: frameworkSettings?.pollingStrategies ?? [],
    useStaticServer,
    clearPublishDirectory: frameworkSettings?.clearPublishDirectory,
  }
}

/**
 * Handles a forced framework and retrieves the settings for it
 */
const handleForcedFramework = async (options: {
  command: BaseCommand
  devConfig: DevConfig
  project: Project
  workingDir: string
  workspacePackage?: string
}): Promise<BaseServerSettings> => {
  // this throws if `devConfig.framework` is not a supported framework
  const framework = await getFramework(options.devConfig.framework, options.project)
  const settings = await getSettings(framework, options.project, options.workspacePackage || '')
  const frameworkSettings = getSettingsFromDetectedSettings(options.command, settings)
  // TODO(serhalp): Remove and update `getSettingsFromDetectedSettings` type to return non-nullable
  // when given non-nullable second arg
  if (frameworkSettings == null) {
    throw new Error(`Could not get settings for framework ${options.devConfig.framework}`)
  }
  return mergeSettings({ devConfig: options.devConfig, workingDir: options.workingDir, frameworkSettings })
}

/**
 * Get the server settings based on the flags and the devConfig
 */
const detectServerSettings = async (
  devConfig: DevConfig,
  flags: OptionValues,
  command: BaseCommand,
): Promise<ServerSettings> => {
  validateProperty(devConfig, 'framework', 'string')

  let settings: BaseServerSettings

  if (flags.dir || devConfig.framework === '#static') {
    // serving files statically without a framework server
    settings = await handleStaticServer({ flags, devConfig, workingDir: command.workingDir })
  } else if (devConfig.framework === '#custom') {
    validateFrameworkConfig({ devConfig })
    // when the users wants to configure `command` and `targetPort`
    settings = handleCustomFramework({ devConfig, workingDir: command.workingDir })
  } else if (devConfig.framework && devConfig.framework !== '#auto') {
    validateFrameworkConfig({ devConfig })
    // this is when the user explicitly configures a framework, e.g. `framework = "gatsby"`
    settings = await handleForcedFramework({
      command,
      devConfig,
      project: command.project,
      workingDir: command.workingDir,
      workspacePackage: command.workspacePackage,
    })
  } else {
    // this is the default CLI behavior (#auto or undefined)
    const runDetection = !hasCommandAndTargetPort(devConfig)
    const frameworkSettings = runDetection
      ? getSettingsFromDetectedSettings(command, await detectFrameworkSettings(command, 'dev'))
      : undefined

    if (frameworkSettings === undefined && runDetection) {
      log(`${NETLIFYDEVWARN} No app server detected. Using simple static server`)
      settings = await handleStaticServer({ flags, devConfig, workingDir: command.workingDir })
    } else {
      validateFrameworkConfig({ devConfig })

      const mergedSettings = await mergeSettings({ devConfig, frameworkSettings, workingDir: command.workingDir })
      settings = { ...mergedSettings, plugins: frameworkSettings?.plugins }
    }
  }

  validateConfiguredPort({ devConfig, detectedPort: settings.frameworkPort })

  const acquiredPort = await acquirePort({
    configuredPort: devConfig.port,
    defaultPort: DEFAULT_PORT,
    errorMessage: `Could not acquire required ${formatProperty('port')}`,
  })
  const functionsDir = devConfig.functions || settings.functions

  return {
    ...settings,
    port: acquiredPort,
    jwtSecret: devConfig.jwtSecret || 'secret',
    jwtRolePath: devConfig.jwtRolePath || 'app_metadata.authorization.roles',
    functions: functionsDir,
    functionsPort: await getPort({ port: devConfig.functionsPort || 0 }),
    ...(devConfig.https && { https: await readHttpsSettings(devConfig.https) }),
  }
}

/**
 * Returns a copy of the provided config with any plugins provided by the
 * server settings
 */
export const getConfigWithPlugins = (config: CachedConfig['config'], settings: ServerSettings) => {
  if (!settings.plugins) {
    return config
  }

  // If there are plugins that we should be running for this project, add them
  // to the config as if they were declared in netlify.toml. We must check
  // whether the plugin has already been added by another source (like the
  // TOML file or the UI), as we don't want to run the same plugin twice.
  const { plugins: existingPlugins = [] } = config
  const existingPluginNames = new Set(existingPlugins.map((plugin) => plugin.package))
  const newPlugins = settings.plugins
    .map((pluginName) => {
      if (existingPluginNames.has(pluginName)) {
        return
      }

      return { package: pluginName, origin: 'config', inputs: {} }
    })
    .filter((plugin): plugin is { package: string; origin: 'config'; inputs: Record<never, never> } => plugin != null)

  return {
    ...config,
    plugins: [...newPlugins, ...(config.plugins ?? [])],
  }
}

export default detectServerSettings
