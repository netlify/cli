const build = require('@netlify/build')

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
const getBuildOptions = ({
  context: {
    netlify: { cachedConfig },
  },
  token,
  flags: { dry, debug, json, silent, offline },
}) => ({
  cachedConfig,
  token,
  dry,
  debug,
  mode: 'cli',
  telemetry: false,
  // buffer = true will not stream output
  buffer: json || silent,
  offline,
})

const runBuild = async (options) => {
  const { severityCode: exitCode, netlifyConfig: newConfig } = await build(options)
  return { exitCode, newConfig }
}

module.exports = { getBuildOptions, runBuild }
