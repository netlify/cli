const build = require('@netlify/build')

const { getSiteInformation } = require('../utils/dev')

const getBuildEnv = async ({ context }) => {
  const { warn, error, netlify } = context
  const { site, api, siteInfo } = netlify
  const { teamEnv, addonsEnv, siteEnv } = await getSiteInformation({
    api,
    site,
    warn,
    error,
    siteInfo,
  })
  const env = { ...teamEnv, ...addonsEnv, ...siteEnv }
  return env
}

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
const getBuildOptions = async ({ context, token, flags }) => {
  const cachedConfig = JSON.stringify(context.netlify.cachedConfig)
  const { dry, debug } = flags
  // buffer = true will not stream output
  const buffer = flags.json || flags.silent

  const env = await getBuildEnv({
    context,
  })

  return { cachedConfig, token, dry, debug, mode: 'cli', telemetry: false, buffer, env }
}

const runBuild = async (options) => {
  const { severityCode: exitCode } = await build(options)
  return exitCode
}

module.exports = { getBuildOptions, runBuild }
