const build = require('@netlify/build')

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
const getBuildOptions = ({
  context: {
    netlify: { cachedConfig },
  },
  flags: { debug, dry, json, offline, silent },
  token,
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
  featureFlags: {
    functionsBundlingManifest: true,
  },
})

const runBuild = async (options) => {
  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options)
  return { exitCode, newConfig, configMutations }
}

module.exports = { getBuildOptions, runBuild }
