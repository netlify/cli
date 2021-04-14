const build = require('@netlify/build')

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
const getBuildOptions = ({
  context: {
    netlify: { cachedConfig },
  },
  token,
  flags: { dry, debug, json, silent },
}) => ({
  cachedConfig,
  token,
  dry,
  debug,
  mode: 'cli',
  telemetry: false,
  // buffer = true will not stream output
  buffer: json || silent,
})

const runBuild = async (options) => {
  const { severityCode: exitCode } = await build(options)
  return exitCode
}

module.exports = { getBuildOptions, runBuild }
