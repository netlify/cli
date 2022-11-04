// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getBuildOp... Remove this comment to see the full error message
const { getBuildOptions, runBuild } = require('../../lib/build.cjs')
const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
  error,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'exit'.
  exit,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'generateNe... Remove this comment to see the full error message
  generateNetlifyGraphJWT,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getEnvelop... Remove this comment to see the full error message
  getEnvelopeEnv,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getToken'.
  getToken,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeC... Remove this comment to see the full error message
  normalizeContext,
} = require('../../utils/index.mjs')

/**
 * @param {import('../../lib/build').BuildConfig} options
 */
const checkOptions = ({
  cachedConfig: { siteInfo = {} },
  token
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  if (!siteInfo.id) {
    error('Could not find the site ID. Please run netlify link.')
  }

  if (!token) {
    error('Could not find the access token. Please run netlify login.')
  }
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const injectEnv = async function (command: $TSFixMe, {
  api,
  buildOptions,
  context,
  site,
  siteInfo
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'build'.
const build = async (options: $TSFixMe, command: $TSFixMe) => {
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
  const [token] = await getToken()

  const { cachedConfig, siteInfo } = command.netlify
  const buildOptions = await getBuildOptions({
    cachedConfig,
    token,
    options,
  })

  if (!options.offline) {
    checkOptions(buildOptions)
    const { api, site } = command.netlify
    const { context } = options
    await injectEnv(command, { api, buildOptions, context, site, siteInfo })
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}

/**
 * Creates the `netlify build` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createBuil... Remove this comment to see the full error message
const createBuildCommand = (program: $TSFixMe) => program
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
