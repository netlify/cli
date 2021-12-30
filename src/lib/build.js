// @ts-check
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
const getBuildOptions = ({ cachedConfig, options: { debug, dry, json, offline, silent }, token }) => ({
  cachedConfig,
  token,
  dry,
  debug,
  mode: 'cli',
  telemetry: false,
  // buffer = true will not stream output
  buffer: json || silent,
  offline,
  featureFlags: {
    functionsBundlingManifest: true,
  },
})

/**
 * run the build command
 * @param {BuildConfig} options
 * @returns
 */
const runBuild = async (options) => {
  const { default: build } = await netlifyBuildPromise
  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options)
  return { exitCode, newConfig, configMutations }
}

module.exports = { getBuildOptions, runBuild }
