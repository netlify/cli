// @ts-check
const process = require('process')

const netlifyBuildPromise = import('@netlify/build')

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
 * @param {BuildConfig} options
 * @returns
 */
const runBuild = async (options) => {
  const { default: build } = await netlifyBuildPromise

  // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
  // TODO don't use testOpts, but add real properties to do this.
  if (process.env.NETLIFY_API_URL) {
    const apiUrl = new URL(process.env.NETLIFY_API_URL)
    const testOpts = {
      scheme: apiUrl.protocol.slice(0, -1),
      host: apiUrl.host,
    }
    options = { ...options, testOpts }
  }

  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options)
  return { exitCode, newConfig, configMutations }
}

module.exports = { getBuildOptions, runBuild }
