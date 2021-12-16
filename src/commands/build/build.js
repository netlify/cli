// @ts-check
const { getBuildOptions, runBuild } = require('../../lib/build')
const { error, exit, getToken } = require('../../utils')

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
