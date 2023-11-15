// @ts-check
import { getBuildOptions, runBuild } from '../../lib/build.mjs'
import { detectFrameworkSettings } from '../../utils/build-info.mjs'
import { error, exit, getToken } from '../../utils/command-helpers.mjs'
import { getEnvelopeEnv } from '../../utils/env/index.mjs'

/**
 * @param {import('../../lib/build.mjs').BuildConfig} options
 */
export const checkOptions = ({ cachedConfig: { siteInfo = {} }, token }) => {
  if (!siteInfo.id) {
    error(
      'Could not find the site ID. If your site is not on Netlify, please run `netlify init` or `netlify deploy` first. If it is, please run `netlify link`.',
    )
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
export const build = async (options, command) => {
  const { cachedConfig, siteInfo } = command.netlify
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
  const [token] = await getToken()
  const settings = await detectFrameworkSettings(command, 'build')

  // override the build command with the detection result if no command is specified through the config
  if (!cachedConfig.config.build.command) {
    cachedConfig.config.build.command = settings?.buildCommand
    cachedConfig.config.build.commandOrigin = 'heuristics'
  }

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
    await injectEnv(command, { api, buildOptions, context, site, siteInfo })
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}
