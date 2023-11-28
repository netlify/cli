import fs from 'fs'
import process from 'process'

import build from '@netlify/build'
import type { OptionValues } from 'commander'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'toml... Remove this comment to see the full error message
import tomlify from 'tomlify-j0.4'

import { isFeatureFlagEnabled } from '../utils/feature-flags.js'

import { getBootstrapURL } from './edge-functions/bootstrap.js'
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $FIXME = any

interface EventHandler {
  handler: $FIXME
  description: string
}

const getFeatureFlagsFromSiteInfo = (siteInfo: $FIXME): Record<string, any> => ({
  ...siteInfo.feature_flags,
  // see https://github.com/netlify/pod-dev-foundations/issues/581#issuecomment-1731022753
  zisi_golang_use_al2: isFeatureFlagEnabled('cli_golang_use_al2', siteInfo),
})

/**
 * The buildConfig + a missing cachedConfig
 * @typedef BuildConfig
 * @type {Parameters<import('@netlify/build/src/core/main.js')>[0] & {cachedConfig: any}}
 */

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
export const getBuildOptions = ({
  cachedConfig,
  currentDir,
  deployHandler,
  options: { context, cwd, debug, dry, json, offline, silent },
  packagePath,
  token,
}: {
  options: OptionValues
  cachedConfig: $FIXME
  currentDir: string
  deployHandler?: $FIXME
  packagePath: string
  token: string
}) => {
  const eventHandlers: { onEnd: EventHandler; onPostBuild?: EventHandler } = {
    onEnd: {
      // @ts-expect-error TS(7031) FIXME: Binding element 'netlifyConfig' implicitly has an ... Remove this comment to see the full error message
      handler: ({ netlifyConfig }) => {
        const string = tomlify.toToml(netlifyConfig)

        if (!fs.existsSync(`${currentDir}/.netlify`)) {
          fs.mkdirSync(`${currentDir}/.netlify`, { recursive: true })
        }
        fs.writeFileSync(`${currentDir}/.netlify/netlify.toml`, string)

        return {}
      },
      description: 'Save updated config',
    },
  }

  if (deployHandler) {
    eventHandlers.onPostBuild = {
      handler: deployHandler,
      description: 'Deploy Site',
    }
  }

  return {
    cachedConfig,
    siteId: cachedConfig.siteInfo.id,
    packagePath,
    token,
    dry,
    debug,
    context,
    mode: 'cli',
    telemetry: false,
    // buffer = true will not stream output
    buffer: json || silent,
    offline,
    cwd,
    featureFlags: {
      ...edgeFunctionsFeatureFlags,
      ...getFeatureFlagsFromSiteInfo(cachedConfig.siteInfo),
      functionsBundlingManifest: true,
    },
    eventHandlers,
    edgeFunctionsBootstrapURL: getBootstrapURL(),
  } as const
}

export const runBuild = async (options: ReturnType<typeof getBuildOptions>) => {
  // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
  // TODO don't use testOpts, but add real properties to do this.
  if (process.env.NETLIFY_API_URL) {
    const apiUrl = new URL(process.env.NETLIFY_API_URL)
    const testOpts = {
      scheme: apiUrl.protocol.slice(0, -1),
      host: apiUrl.host,
    }
    // @ts-expect-error TS(2554) FIXME
    options = { ...options, testOpts }
  }

  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options)
  return { exitCode, newConfig, configMutations }
}
