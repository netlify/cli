import fs from 'fs'
import process from 'process'

import build, { type OnEnd, type OnPostBuild } from '@netlify/build'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'toml... Remove this comment to see the full error message
import tomlify from 'tomlify-j0.4'
import type { OptionValues } from 'commander'

import { getFeatureFlagsFromSiteInfo } from '../utils/feature-flags.js'
import type { EnvironmentVariables } from '../utils/types.js'

import { getBootstrapURL } from './edge-functions/bootstrap.js'
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.js'

export interface CachedConfig {
  env: EnvironmentVariables
  siteInfo: {
    id?: string
    account_id?: string
    feature_flags?: Record<string, boolean | boolean | number>
  }
  // TODO(serhalp) Add remaining properties
  [k: string]: unknown
}

interface DefaultConfig {
  // TODO(serhalp) Add remaining properties
  [k: string]: unknown
}

// TODO(serhalp) This is patching weak or missing properties from @netlify/build. Fix there instead.
export type BuildConfig = Parameters<typeof build>[0] & {
  cachedConfig: CachedConfig
  defaultConfig: DefaultConfig
  // It's possible this one is correct in @netlify/build. Remove and stop passing it if so.
  accountId?: string
  edgeFunctionsBootstrapURL: string
}

interface HandlerResult {
  newEnvChanges?: Record<string, string>
  configMutations?: Record<string, string>
  status?: string
}
// The @netlify/build type incorrectly states a `void | Promise<void>` return type.
type PatchedHandlerType<T extends (opts: any) => void | Promise<void>> = (
  opts: Parameters<T>[0],
) => HandlerResult | Promise<HandlerResult>

type EventHandler<T extends (opts: any) => void | Promise<void>> = {
  handler: PatchedHandlerType<T>
  description: string
}

// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
export const getBuildOptions = async ({
  cachedConfig,
  currentDir,
  defaultConfig,
  deployHandler,
  options: { context, cwd, debug, dry, json, offline, silent },
  packagePath,
  token,
}: {
  cachedConfig: CachedConfig
  currentDir: string
  defaultConfig?: DefaultConfig
  deployHandler?: PatchedHandlerType<OnPostBuild>
  options: OptionValues
  packagePath?: string
  token?: null | string
}): Promise<BuildConfig> => {
  const eventHandlers: { onEnd: EventHandler<OnEnd>; onPostBuild?: EventHandler<OnPostBuild> } = {
    onEnd: {
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
    defaultConfig: defaultConfig ?? {},
    siteId: cachedConfig.siteInfo.id,
    accountId: cachedConfig.siteInfo.account_id,
    packagePath,
    token: token ?? undefined,
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
    // @ts-expect-error(serhalp) -- TODO(serhalp) Upstream the type fixes above into @netlify/build
    eventHandlers,
    edgeFunctionsBootstrapURL: await getBootstrapURL(),
  }
}

export const runBuild = async (options: BuildConfig) => {
  // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
  // TODO don't use testOpts, but add real properties to do this.
  if (process.env.NETLIFY_API_URL) {
    const apiUrl = new URL(process.env.NETLIFY_API_URL)
    const testOpts = {
      scheme: apiUrl.protocol.slice(0, -1),
      host: apiUrl.host,
    }
    // @ts-expect-error(serhalp) -- I don't know what's going on here and I can't convince myself it even works as
    // intended. TODO(serhalp) Investigate and fix types.
    options = { ...options, testOpts }
  }

  const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options)
  return { exitCode, newConfig, configMutations }
}
