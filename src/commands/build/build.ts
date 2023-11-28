import { OptionValues } from 'commander'

import { getBuildOptions, runBuild } from '../../lib/build.js'
import { detectFrameworkSettings } from '../../utils/build-info.js'
import { error, exit, getToken } from '../../utils/command-helpers.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'
import { NetlifyAPI } from 'netlify'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $FIXME = any

export const injectEnv = async function ({
  api,
  buildOptions,
  context,
  siteInfo,
}: {
  api: NetlifyAPI
  buildOptions: ReturnType<typeof getBuildOptions>
  context: string
  siteInfo: $FIXME
}) {
  const isUsingEnvelope = siteInfo && siteInfo.use_envelope

  const { env } = buildOptions.cachedConfig
  if (isUsingEnvelope) {
    buildOptions.cachedConfig.env = await getEnvelopeEnv({ api, context, env, siteInfo })
  }
}

export const build = async (options: OptionValues, command: BaseCommand) => {
  const { cachedConfig, siteInfo } = command.netlify
  command.setAnalyticsPayload({ dry: options.dry })
  // Retrieve Netlify Build options
  const [token] = await getToken()
  const settings = await detectFrameworkSettings(command, 'build')

  if (!token) {
    throw new Error('Could not find the access token. Please run netlify login.')
  }

  // override the build command with the detection result if no command is specified through the config
  if (!cachedConfig.config.build.command) {
    cachedConfig.config.build.command = settings?.buildCommand
    cachedConfig.config.build.commandOrigin = 'heuristics'
  }

  const buildOptions = getBuildOptions({
    cachedConfig,
    packagePath: command.workspacePackage,
    currentDir: command.workingDir,
    token,
    options,
  })

  if (!options.offline) {
    checkOptions(buildOptions)
    const { api } = command.netlify
    const { context } = options
    await injectEnv({ api, buildOptions, context, siteInfo })
  }

  const { exitCode } = await runBuild(buildOptions)
  exit(exitCode)
}
