import process from 'process'

import type { NetlifyAPI } from 'netlify'
import { applyMutations } from '@netlify/config'
import { OptionValues } from 'commander'

import { BLOBS_CONTEXT_VARIABLE, encodeBlobsContext, getBlobsContextWithEdgeAccess } from '../../lib/blobs/blobs.js'
import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.js'
import { startFunctionsServer } from '../../lib/functions/server.js'
import { printBanner } from '../../utils/banner.js'
import {
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  type NormalizedCachedConfigConfig,
  ansis,
  log,
  normalizeConfig,
} from '../../utils/command-helpers.js'
import detectServerSettings, { getConfigWithPlugins } from '../../utils/detect-server-settings.js'
import { UNLINKED_SITE_MOCK_ID, getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { getLiveTunnelSlug, startLiveTunnel } from '../../utils/live-tunnel.js'
import openBrowser from '../../utils/open-browser.js'
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.js'
import { getProxyUrl } from '../../utils/proxy.js'
import { runDevTimeline } from '../../utils/run-build.js'
import type { CLIState, ServerSettings } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'
import type { NetlifySite } from '../types.js'

import type { DevConfig } from './types.js'

const handleLiveTunnel = async ({
  api,
  options,
  settings,
  site,
  state,
}: {
  api: NetlifyAPI
  options: OptionValues
  settings: ServerSettings
  site: NetlifySite
  state: CLIState
}) => {
  const { live } = options

  if (live) {
    const customSlug = typeof live === 'string' && live.length !== 0 ? live : undefined
    const slug = getLiveTunnelSlug(state, customSlug)

    let message = `${NETLIFYDEVWARN} Creating live URL with ID ${ansis.yellow(slug)}`

    if (!customSlug) {
      message += ` (to generate a custom URL, use ${ansis.magenta('--live=<subdomain>')})`
    }

    log(message)

    const sessionUrl = await startLiveTunnel({
      siteId: site.id,
      netlifyApiToken: api.accessToken,
      localPort: settings.port,
      slug,
    })

    process.env.BASE_URL = sessionUrl

    return sessionUrl
  }
}

export const dev = async (options: OptionValues, command: BaseCommand) => {
  log(NETLIFYDEV)
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  config.dev = config.dev != null ? { ...config.dev } : undefined
  config.build = { ...config.build }
  const devConfig: DevConfig = {
    framework: '#auto',
    autoLaunch: Boolean(options.open),
    ...(cachedConfig.siteInfo.dev_server_settings && {
      command: cachedConfig.siteInfo.dev_server_settings.cmd,
      targetPort: cachedConfig.siteInfo.dev_server_settings.target_port,
    }),
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...('publish' in config.build && config.build.publish && { publish: config.build.publish }),
    ...(config.build.base && { base: config.build.base }),
    ...config.dev,
    ...options,
  }

  let { env } = cachedConfig

  env.NETLIFY_DEV = { sources: ['internal'], value: 'true' }

  const blobsContext = await getBlobsContextWithEdgeAccess({
    debug: options.debug,
    projectRoot: command.workingDir,
    siteID: site.id ?? UNLINKED_SITE_MOCK_ID,
  })

  env[BLOBS_CONTEXT_VARIABLE] = { sources: ['internal'], value: encodeBlobsContext(blobsContext) }

  if (!options.offline && !options.offlineEnv) {
    env = await getEnvelopeEnv({ api, context: options.context, env, siteInfo })
    log(`${NETLIFYDEVLOG} Injecting environment variable values for ${ansis.yellow('all scopes')}`)
  }

  env = await getDotEnvVariables({ devConfig, env, site })
  injectEnvVariables(env)
  await promptEditorHelper({ ansis, config, log, NETLIFYDEVLOG, repositoryRoot, state })

  const { accountId, addonsUrls, capabilities, siteUrl, timeouts } = await getSiteInformation({
    // inherited from base command --offline

    offline: options.offline,
    api,
    site,
    siteInfo,
  })

  let settings: ServerSettings
  try {
    settings = await detectServerSettings(devConfig, options, command)

    const { NETLIFY_INCLUDE_DEV_SERVER_PLUGIN } = process.env

    if (NETLIFY_INCLUDE_DEV_SERVER_PLUGIN) {
      const plugins = NETLIFY_INCLUDE_DEV_SERVER_PLUGIN.split(',')
      if (options.debug) {
        log(`${NETLIFYDEVLOG} Including dev server plugins: ${NETLIFY_INCLUDE_DEV_SERVER_PLUGIN}`)
      }
      settings.plugins = [...(settings.plugins ?? []), ...plugins]
    }

    // TODO(serhalp): Doing this as a side effect inside `BaseCommand` like this is WILD.
    // Refactor this to be more explicit and less brittle.
    cachedConfig.config = getConfigWithPlugins(cachedConfig.config, settings)
  } catch (error) {
    if (error instanceof Error) {
      log(NETLIFYDEVERR, error.message)
    }

    process.exit(1)
  }

  command.setAnalyticsPayload({ live: options.live })

  const liveTunnelUrl = await handleLiveTunnel({ options, site, api, settings, state })

  const url = liveTunnelUrl || getProxyUrl(settings)

  process.env.URL = url
  process.env.DEPLOY_URL = url

  log(`${NETLIFYDEVWARN} Setting up local development server`)

  const { configMutations, configPath: configPathOverride } = await runDevTimeline({
    command,
    options,
    settings,
    env: {
      URL: url,
      DEPLOY_URL: url,
    },
  })

  // FIXME(serhalp): `applyMutations` is `(any, any) => any)`. Add types in `@netlify/config`.

  const mutatedConfig: typeof config = applyMutations(config, configMutations)

  const functionsRegistry = await startFunctionsServer({
    blobsContext,
    command,
    config: mutatedConfig,

    debug: options.debug,
    settings,
    site,
    siteInfo,
    siteUrl,
    capabilities,
    timeouts,
    geolocationMode: options.geo,
    geoCountry: options.country,
    offline: options.offline,
    state,
    accountId,
  })

  // Try to add `.netlify` to `.gitignore`.
  try {
    await ensureNetlifyIgnore(repositoryRoot)
  } catch {
    // no-op
  }

  // TODO: We should consolidate this with the existing config watcher.
  const getUpdatedConfig = async (): Promise<NormalizedCachedConfigConfig> => {
    const { config: newConfig } = await command.getConfig({
      cwd: command.workingDir,
      offline: true,
    })
    return normalizeConfig(newConfig)
  }

  const inspectSettings = generateInspectSettings(options.edgeInspect, options.edgeInspectBrk)

  await startProxyServer({
    addonsUrls,
    api,
    blobsContext,
    command,
    config: mutatedConfig,
    configPath: configPathOverride,
    debug: options.debug,
    disableEdgeFunctions: options.internalDisableEdgeFunctions,
    projectDir: command.workingDir,
    env,
    getUpdatedConfig,
    inspectSettings,
    offline: options.offline,
    settings,
    site,
    siteInfo,
    state,
    geolocationMode: options.geo,
    geoCountry: options.country,
    accountId,
    functionsRegistry,
    repositoryRoot,
  })

  if (devConfig.autoLaunch !== false) {
    await openBrowser({ url, silentBrowserNoneError: true })
  }

  printBanner({ url })
}
