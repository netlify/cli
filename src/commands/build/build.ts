import { OptionValues } from 'commander'

import { getBuildOptions, runBuild } from '../../lib/build.js'
import { detectFrameworkSettings, getDefaultConfig } from '../../utils/build-info.js'
import { error, exit, getToken } from '../../utils/command-helpers.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

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

export const build = async (options: OptionValues, command: BaseCommand) => {
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
    // @ts-expect-error TS(2740)
    options,
  })

  if (!options.offline) {
    checkOptions(buildOptions)

    buildOptions.cachedConfig.env = await getEnvelopeEnv({
      api: command.netlify.api,
      context: options.context,
      env: buildOptions.cachedConfig.env,
      siteInfo,
    })
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}
