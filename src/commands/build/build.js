// @ts-check
const { getBuildOptions, runBuild } = require('../../lib/build')
const { error, exit, generateNetlifyGraphJWT, getToken } = require('../../utils')

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

const injectNetlifyGraphEnv = async function (command, { api, buildOptions, site }) {
  const siteData = await api.getSite({ siteId: site.id })
  const authlifyTokenId = siteData && siteData.authlify_token_id

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

  const buildOptions = await getBuildOptions({
    cachedConfig: command.netlify.cachedConfig,
    token,
    options,
  })

  if (!options.offline) {
    checkOptions(buildOptions)
    const { api, site } = command.netlify
    await injectNetlifyGraphEnv(command, { api, site, buildOptions })
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
    .option('--dry', 'Dry run: show instructions without running them', false)
    .option('--context [context]', 'Build context')
    .option('-o, --offline', 'disables any features that require network access', false)
    .addExamples(['netlify build'])
    .action(build)

module.exports = { createBuildCommand }
