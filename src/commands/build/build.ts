 
import process from 'process'

import { getBuildOptions, runBuild } from '../../lib/build.js'
import { detectFrameworkSettings } from '../../utils/build-info.js'
import { error, exit, getToken } from '../../utils/command-helpers.js'
import { getEnvelopeEnv, normalizeContext } from '../../utils/env/index.js'

/**
 * @param {import('../../lib/build.js').BuildConfig} options
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'token' implicitly has an 'any' ty... Remove this comment to see the full error message
export const checkOptions = ({ cachedConfig: { siteInfo = {} }, token }) => {
  // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type '{}'.
  if (!siteInfo.id) {
    error(
      'Could not find the site ID. If your site is not on Netlify, please run `netlify init` or `netlify deploy` first. If it is, please run `netlify link`.',
    )
  }

  if (!token) {
    error('Could not find the access token. Please run netlify login.')
  }
}

// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
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
 * @param {import('../base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const build = async (options, command) => {
  const { cachedConfig, siteInfo } = command.netlify
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
  // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
  const [token] = await getToken()
  const settings = await detectFrameworkSettings(command, 'build')

  // override the build command with the detection result if no command is specified through the config
  if (!cachedConfig.config.build.command) {
    cachedConfig.config.build.command = settings?.buildCommand
    cachedConfig.config.build.commandOrigin = 'heuristics'
  }

  // @ts-expect-error TS(2345) FIXME: Argument of type '{ cachedConfig: any; packagePath... Remove this comment to see the full error message
  const buildOptions = await getBuildOptions({
    cachedConfig,
    packagePath: command.workspacePackage,
    currentDir: command.workingDir,
    token,
    options,
  })

  if (!options.offline) {
    checkOptions(buildOptions)
    const { api, site } = command.netlify
    const { context } = options
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ api: any; buildOptions: { cach... Remove this comment to see the full error message
    await injectEnv(command, { api, buildOptions, context, site, siteInfo })
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}

/**
 * Creates the `netlify build` command
 * @param {import('../base-command.js').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createBuildCommand = (program) =>
  program
    .command('build')
    .description('Build on your local machine')
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
