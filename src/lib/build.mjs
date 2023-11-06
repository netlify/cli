// @ts-check
import fs from 'fs'
import process from 'process'

import build from '@netlify/build'
import tomlify from 'tomlify-j0.4'

import { isFeatureFlagEnabled } from '../utils/feature-flags.mjs'

import { getBootstrapURL } from './edge-functions/bootstrap.mjs'
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.mjs'

/**
 * The buildConfig + a missing cachedConfig
 * @typedef BuildConfig
 * @type {Parameters<import('@netlify/build/src/core/main.js')>[0] & {cachedConfig: any}}
 */

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
/**
 *
 * @param {object} config
 * @param {*} config.cachedConfig
 * @param {string} [config.packagePath]
 * @param {string} config.currentDir
 * @param {string} config.token
 * @param {import('commander').OptionValues} config.options
 * @param {*} config.deployHandler
 * @returns {BuildConfig}
 */
export const getBuildOptions = ({
  cachedConfig,
  currentDir,
  deployHandler,
  options: { context, cwd, debug, dry, json, offline, silent },
  packagePath,
  token,
}) => ({
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
  eventHandlers: {
    onPostBuild: deployHandler
      ? {
          handler: deployHandler,
          description: 'Deploy Site',
        }
      : undefined,
    onEnd: ({ netlifyConfig }) => {
      const string = tomlify.toToml(netlifyConfig)

      if (!fs.existsSync(`${currentDir}/.netlify`)) {
        fs.mkdirSync(`${currentDir}/.netlify`, { recursive: true })
      }
      fs.writeFileSync(`${currentDir}/.netlify/netlify.toml`, string)

      return {}
    },
  },
  edgeFunctionsBootstrapURL: getBootstrapURL(),
})

/**
 * @param {*} siteInfo
 * @returns {Record<string, any>}
 */
const getFeatureFlagsFromSiteInfo = (siteInfo) => ({
  ...siteInfo.feature_flags,
  // see https://github.com/netlify/pod-dev-foundations/issues/581#issuecomment-1731022753
  zisi_golang_use_al2: isFeatureFlagEnabled('cli_golang_use_al2', siteInfo),
})

/**
 * run the build command
 * @param {BuildConfig} options
 * @returns
 */
export const runBuild = async (options) => {
  // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
  // TODO don't use testOpts, but add real properties to do this.
  if (process.env.NETLIFY_API_URL) {
    const apiUrl = new URL(process.env.NETLIFY_API_URL)
    const testOpts = {
      scheme: apiUrl.protocol.slice(0, -1),
      host: apiUrl.host,
    }
    options = { ...options, testOpts }
  }

  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options)
  return { exitCode, newConfig, configMutations }
}
