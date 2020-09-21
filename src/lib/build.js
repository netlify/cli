const build = require('@netlify/build')

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
const getBuildOptions = ({ netlify, token, flags }) => {
  const cachedConfig = JSON.stringify(netlify.cachedConfig)
  const { dry, debug } = flags
  return { cachedConfig, token, dry, debug, mode: 'cli', telemetry: false }
}

const runBuild = async options => {
  const { severityCode: exitCode } = await build(options)
  return exitCode
}

module.exports = { getBuildOptions, runBuild }
