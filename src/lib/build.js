// @ts-check
const process = require('process')

const netlifyBuildPromise = import('@netlify/build')

const { NETLIFYDEVERR, detectServerSettings, exit, log } = require('../utils')

/**
 * The buildConfig + a missing cachedConfig
 * @typedef BuildConfig
 * @type {Parameters<import('@netlify/build/src/core/main')>[0] & {cachedConfig: any}}
 */

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
/**
 *
 * @param {object} config
 * @param {*} config.cachedConfig
 * @param {string} config.token
 * @param {import('commander').OptionValues} config.options
 * @returns {BuildConfig}
 */
const getBuildOptions = ({ cachedConfig, options: { context, cwd, debug, dry, json, offline, silent }, token }) => ({
  cachedConfig,
  siteId: cachedConfig.siteInfo.id,
  token,
  dry,
  debug,
  context,
  mode: 'cli',
  telemetry: false,
  // buffer = true will not stream output
  buffer: json || silent,
  offline,
  cwd,
  featureFlags: {
    functionsBundlingManifest: true,
    edge_functions_produce_eszip: true,
  },
})

/**
 * run the build command
 * @param {BuildConfig} buildOptions
 * @param {import('../commands/base-command').BaseCommand} command
 * @param {import('commander').OptionValues} commandOptions
 * @returns
 */
const runBuild = async (buildOptions, command, commandOptions) => {
  const { default: build } = await netlifyBuildPromise
  const { cachedConfig, config, site } = command.netlify
  const devConfig = {
    framework: '#auto',
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
    ...config.dev,
    ...commandOptions,
  }
  console.log({ cachedConfig })

  // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
  // TODO don't use testOpts, but add real properties to do this.
  if (process.env.NETLIFY_API_URL) {
    const apiUrl = new URL(process.env.NETLIFY_API_URL)
    const testOpts = {
      scheme: apiUrl.protocol.slice(0, -1),
      host: apiUrl.host,
    }
    buildOptions = { ...buildOptions, testOpts }
  }

  /** @type {Partial<import('../../utils/types').ServerSettings>} */
  let settings = {}
  try {
    settings = await detectServerSettings(devConfig, commandOptions, site.root)

    console.log({ settings: settings.dist })

    if (settings.dist) {
      const buildPath = '/Users/sarahetter/test-projects/aug24/.next'
      buildOptions.cachedConfig.config.build.publish = buildPath

      // console.log({ publish: buildOptions.cachedConfig.config.build.publish })
    }

    // If there are plugins that we should be running for this site, add them
    // to the config as if they were declared in netlify.toml. We must check
    // whether the plugin has already been added by another source (like the
    // TOML file or the UI), as we don't want to run the same plugin twice.
    if (settings.plugins) {
      const { plugins: existingPlugins = [] } = cachedConfig.config
      const existingPluginNames = new Set(existingPlugins.map((plugin) => plugin.package))
      const newPlugins = settings.plugins
        .map((pluginName) => {
          if (existingPluginNames.has(pluginName)) {
            return
          }

          return { package: pluginName, origin: 'config', inputs: {} }
        })
        .filter(Boolean)

      buildOptions.cachedConfig.config.plugins = [...newPlugins, ...cachedConfig.config.plugins]
    }
  } catch (error_) {
    log(NETLIFYDEVERR, error_.message)
    exit(1)
  }

  console.log({ buildOptions, config: buildOptions.cachedConfig.config })

  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(buildOptions)
  return { exitCode, newConfig, configMutations }
}

module.exports = { getBuildOptions, runBuild }
