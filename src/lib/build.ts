import fs from 'fs'
import process from 'process'

import build, { type NetlifyConfig, type OnEnd, type OnPostBuild } from '@netlify/build'
import type { MinimalHeader } from '@netlify/headers-parser'
import tomlify from 'tomlify-j0.4'
import type { OptionValues } from 'commander'

import { getFeatureFlagsFromSiteInfo } from '../utils/feature-flags.js'
import type { Account, EnvironmentVariables } from '../utils/types.js'
import { getBootstrapURL } from './edge-functions/bootstrap.js'
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.js'

export interface CachedConfig {
  accounts: Account[]
  buildDir: string
  env: EnvironmentVariables
  repositoryRoot: string
  siteInfo: {
    id?: string
    account_id?: string
    feature_flags?: Record<string, boolean | boolean | number>
    // FIXME(serhalp) This has become a rabbit hole. We'll fix this in a follow-up PR.
    [k: string]: any
  }

  // TODO(serhalp) Type these properties:
  addons?: unknown
  api?: unknown
  branch?: unknown
  config: {
    build: {
      base: string
      edge_functions?: undefined | string
      // public?: string TYPO?
      environment: Record<string, unknown>
      publish: string
      publishOrigin: string
      processing: {
        css: Record<string, unknown>
        html: Record<string, unknown>
        images: Record<string, unknown>
        js: Record<string, unknown>
      }
      services: Record<string, unknown>
    }
    functions?: NetlifyConfig['functions']
    functionsDirectory?: undefined | string
    headers: MinimalHeader[]
    redirects: undefined | NetlifyConfig['redirects']
  }
  configPath?: undefined | string
  context: string
  headersPath?: unknown
  integrations: unknown[]
  logs?: unknown
  redirectsPath?: unknown
  token?: unknown
}

export interface DefaultConfig {
  build: {
    command?: string | undefined
    commandOrigin?: 'default' | undefined
    publish?: string | undefined
    publishOrigin?: 'default' | undefined
  }
  plugins?: Array<{ package: unknown; origin: 'default' }>
}

// TODO(serhalp) This is patching weak or missing properties from @netlify/build. Fix there instead.
export type RunBuildOptions = Parameters<typeof build>[0] & {
  cachedConfig: CachedConfig
  defaultConfig: DefaultConfig | {}
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
export const getRunBuildOptions = async ({
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
  defaultConfig?: undefined | DefaultConfig
  deployHandler?: PatchedHandlerType<OnPostBuild>
  options: OptionValues
  packagePath?: string
  token?: null | string
}): Promise<RunBuildOptions> => {
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

export const runBuild = async (options: RunBuildOptions) => {
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
