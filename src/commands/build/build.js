const process = require('process')

// @ts-check
const { getBuildOptions, runBuild } = require('../../lib/build')
const {
  NETLIFYDEVERR,
  detectServerSettings,
  error,
  exit,
  generateNetlifyGraphJWT,
  getEnvelopeEnv,
  getToken,
  log,
  normalizeContext,
} = require('../../utils')

/**
 * @param {import('../../lib/build').BuildConfig} options
 */
const checkOptions = ({ cachedConfig: { siteInfo = {} }, token }) => {
  if (!siteInfo.id) {
    error('Could not find the site ID. Please run netlify link.')
  }

  if (!token) {
    error('Could not find the access token. Please run netlify login.')
  }
}

const injectEnv = async function (command, { api, buildOptions, context, site, siteInfo }) {
  const isUsingEnvelope = siteInfo && siteInfo.use_envelope
  const authlifyTokenId = siteInfo && siteInfo.authlify_token_id

  const { env } = buildOptions.cachedConfig
  if (isUsingEnvelope) {
    buildOptions.cachedConfig.env = await getEnvelopeEnv({ api, context, env, siteInfo })
  }

  if (authlifyTokenId) {
    const netlifyToken = await command.authenticate()
    // Only inject the authlify config if a token ID exists. This prevents
    // calling command.authenticate() (which opens a browser window) if the
    // user hasn't enabled API Authentication
    const netlifyGraphConfig = {
      netlifyToken,
      authlifyTokenId,
      siteId: site.id,
    }

    const netlifyGraphJWT = generateNetlifyGraphJWT(netlifyGraphConfig)

    if (netlifyGraphJWT != null) {
      // XXX(anmonteiro): this name is deprecated. Delete after 3/31/2022
      const varData = { sources: ['general'], value: netlifyGraphJWT }
      buildOptions.cachedConfig.env.ONEGRAPH_AUTHLIFY_TOKEN = varData
      buildOptions.cachedConfig.env.NETLIFY_GRAPH_TOKEN = varData
    }
  }
}

/**
 * The build command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const build = async (options, command) => {
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
  const [token] = await getToken()

  const { cachedConfig, config, site, siteInfo } = command.netlify
  const buildOptions = await getBuildOptions({
    cachedConfig,
    token,
    options,
  })
  const devConfig = {
    framework: '#auto',
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
    ...config.dev,
    ...options,
  }

  if (!options.offline) {
    checkOptions(buildOptions)
    const { api } = command.netlify
    const { context } = options
    await injectEnv(command, { api, buildOptions, context, site, siteInfo })
  }

  /** @type {Partial<import('../../utils/types').ServerSettings>} */
  let settings = {}
  try {
    settings = await detectServerSettings(devConfig, options, site.root)

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

      cachedConfig.config.plugins = [...newPlugins, ...cachedConfig.config.plugins]
    }
  } catch (error_) {
    log(NETLIFYDEVERR, error_.message)
    exit(1)
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}

/**
 * Creates the `netlify build` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createBuildCommand = (program) =>
  program
    .command('build')
    .description('(Beta) Build on your local machine')
    .option(
      '--context <context>',
      'Specify a build context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      process.env.CONTEXT || 'production',
    )
    .option('--dry', 'Dry run: show instructions without running them', false)
    .option('-o, --offline', 'disables any features that require network access', false)
    .addExamples(['netlify build'])
    .action(build)

module.exports = { createBuildCommand }
