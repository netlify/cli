import fs from 'fs'
import process from 'process'

import build, { type NetlifyConfig, type OnEnd, type OnPostBuild, type Logs } from '@netlify/build'
import type { MinimalHeader } from '@netlify/headers-parser'
import tomlify from 'tomlify-j0.4'
import type { OptionValues } from 'commander'

import { getFeatureFlagsFromSiteInfo } from '../utils/feature-flags.js'
import type { MinimalAccount, EnvironmentVariables, Plugin, SiteInfo } from '../utils/types.js'

import { getBootstrapURL } from './edge-functions/bootstrap.js'
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.js'
import type { EdgeFunctionDeclaration } from './edge-functions/proxy.js'

export interface CachedConfig {
  accounts: MinimalAccount[] | undefined
  buildDir: string
  env: EnvironmentVariables
  repositoryRoot: string
  siteInfo: SiteInfo

  // TODO(serhalp): Type these properties:
  api?: unknown
  branch?: unknown
  config: {
    build: {
      base: string
      command?: string | undefined
      functions?: string | undefined
      // TODO(serhalp): I'm fairly certain this is not real. Confirm and remove from here and `ntl functions:build`.
      functionsSource?: string | undefined
      edge_functions?: string | undefined
      environment: Record<string, unknown>
      processing: {
        css: Record<string, unknown>
        html: Record<string, unknown>
        images: Record<string, unknown>
        js: Record<string, unknown>
      }
      publish: string
      publishOrigin: string
      services: Record<string, unknown>
    }
    // TODO(serhalp): Verify if this should actually be required? If so, update several
    // unrealistic integration test objects.
    dev?:
      | undefined
      | {
          command?: string | undefined
          functions?: string | undefined
          functionsPort?: number | undefined
          https?:
            | {
                certFile: string
                keyFile: string
              }
            | undefined
          envFiles?: string[] | undefined
          env_files?: string[] | undefined
          // FIXME(serhalp): There is absolutely no trace of this in the `netlify/build` codebase yet
          // it appears to be real functionality. Fix this upstream.
          processing: {
            html?: {
              injections?: {
                /**
                 * The location at which the `html` will be injected.
                 * Defaults to `before_closing_head_tag` which will inject the HTML before the </head> tag.
                 */
                location?: 'before_closing_head_tag' | 'before_closing_body_tag'
                /**
                 * The injected HTML code.
                 */
                html: string
              }[]
            }
          }
        }
    edge_functions?: EdgeFunctionDeclaration[]
    functions?: NetlifyConfig['functions']
    functionsDirectory?: undefined | string
    headers: MinimalHeader[]
    images: {
      remote_images: string[]
    }
    plugins?: Plugin[]
    redirects: undefined | NetlifyConfig['redirects']
  }
  configPath?: undefined | string
  context: string
  headersPath?: unknown
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
  plugins?: { package: unknown; origin: 'default' }[]
}

// TODO(serhalp): This is patching weak or missing properties from @netlify/build. Fix there instead.
export type RunBuildOptions = Omit<NonNullable<Parameters<typeof build>[0]>, 'cachedConfig'> & {
  cachedConfig: CachedConfig
  defaultConfig: DefaultConfig | Record<never, never>
  edgeFunctionsBootstrapURL: string
}

interface HandlerResult {
  newEnvChanges?: Record<string, string>
  configMutations?: Record<string, string>
  status?: string
}
// The @netlify/build type incorrectly states a `void | Promise<void>` return type.
export type PatchedHandlerType<T extends (opts: any) => void | Promise<void>> = (
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
  deployId,
  options: { context, cwd, debug, dry, json, offline, silent },
  packagePath,
  skewProtectionToken,
  token,
}: {
  cachedConfig: CachedConfig
  currentDir: string
  defaultConfig?: undefined | DefaultConfig
  deployHandler?: PatchedHandlerType<OnPostBuild>
  deployId?: string
  options: OptionValues
  packagePath?: string
  skewProtectionToken?: string
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
    deployId,
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
    // @ts-expect-error(serhalp) -- TODO(serhalp): Upstream the type fixes above into @netlify/build
    eventHandlers,
    edgeFunctionsBootstrapURL: await getBootstrapURL(),
    skewProtectionToken,
  }
}

export const logsAreBuffered = (logs: unknown): logs is Logs => {
  return logs !== undefined && logs !== null && typeof logs === 'object' && 'stdout' in logs && 'stderr' in logs
}

export const runBuild = async (
  options: RunBuildOptions,
): Promise<{
  exitCode: number
  newConfig: NetlifyConfig
  configMutations: Record<string, string>
  logs?: Logs
}> => {
  // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
  // TODO don't use testOpts, but add real properties to do this.
  if (process.env.NETLIFY_API_URL) {
    const apiUrl = new URL(process.env.NETLIFY_API_URL)
    const testOpts = {
      scheme: apiUrl.protocol.slice(0, -1),
      host: apiUrl.host,
    }
    // @ts-expect-error(serhalp) -- I don't know what's going on here and I can't convince myself it even works as
    // intended. TODO(serhalp): Investigate and fix types.
    options = { ...options, testOpts }
  }

  const {
    configMutations,
    netlifyConfig: newConfig,
    severityCode: exitCode,
    logs,
    // TODO(serhalp): Upstream the type fixes above into @netlify/build and remove this type assertion
  } = await (build as unknown as (opts: RunBuildOptions) => Promise<ReturnType<typeof build>>)(options)
  return { exitCode, newConfig, configMutations, logs: logsAreBuffered(logs) ? logs : undefined }
}
