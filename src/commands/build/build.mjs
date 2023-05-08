// @ts-check
import process from 'process'

import { getBuildOptions, runBuild } from '../../lib/build.mjs'
import { error, exit, getToken } from '../../utils/command-helpers.mjs'
import { getEnvelopeEnv, normalizeContext } from '../../utils/env/index.mjs'

/**
 * @param {import('../../lib/build.mjs').BuildConfig} options
 */
const checkOptions = ({ cachedConfig: { siteInfo = {} }, token }) => {
  if (!siteInfo.id) {
    error('Could not find the site ID. Please run netlify link.')
  }

  if (!token) {
    error('Could not find the access token. Please run netlify login.')
  }
}

const injectEnv = async function (command, { api, buildOptions, context, siteInfo }) {
  const isUsingEnvelope = siteInfo && siteInfo.use_envelope

  const { env } = buildOptions.cachedConfig
  if (isUsingEnvelope) {
    buildOptions.cachedConfig.env = await getEnvelopeEnv({ api, context, env, siteInfo })
  }
}

/**
 * The build command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const build = async (options, command) => {
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createBuildCommand = (program) =>
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
