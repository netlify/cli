import { getBuildOptions, runBuild } from '../../lib/build.js'
import { detectFrameworkSettings, getDefaultConfig } from '../../utils/build-info.js'
import { error, exit, getToken } from '../../utils/command-helpers.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'
import { CheckOptionsParams, BuildOptions } from './types.js'

/**
 * @param {import('../../lib/build.js').BuildConfig} options
 */
export const checkOptions = ({ cachedConfig: {siteInfo = {}}, token }: CheckOptionsParams) => {
  if (!siteInfo.id) {
    error(
      'Could not find the site ID. If your site is not on Netlify, please run `netlify init` or `netlify deploy` first. If it is, please run `netlify link`.',
    )
  }

  if (!token) {
    error('Could not find the access token. Please run netlify login.')
  }
}

export const build = async (options: BuildOptions, command: BaseCommand) => {
  const { cachedConfig, siteInfo } = command.netlify
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
  const [token] = await getToken()
  const settings = await detectFrameworkSettings(command, 'build')

  const buildOptions = await getBuildOptions({
    cachedConfig,
    defaultConfig: getDefaultConfig(settings),
    packagePath: command.workspacePackage,
    currentDir: command.workingDir,
    token,
    options ,
  })

  if (!options.offline) {
    checkOptions(buildOptions)

    buildOptions.cachedConfig.env = await getEnvelopeEnv({
      api: command.netlify.api,
      context: options.context,
      env: buildOptions.cachedConfig.siteInfo.env,
      siteInfo,
    })
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}
