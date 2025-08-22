import process from 'process'

import type { NetlifyAPI } from '@netlify/api'
import { applyMutations } from '@netlify/config'
import { OptionValues } from 'commander'

import { BLOBS_CONTEXT_VARIABLE, encodeBlobsContext, getBlobsContextWithEdgeAccess } from '../../lib/blobs/blobs.js'
import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.js'
import { startFunctionsServer } from '../../lib/functions/server.js'
import { printBanner } from '../../utils/dev-server-banner.js'
import {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  type NormalizedCachedConfigConfig,
  chalk,
  log,
  normalizeConfig,
  netlifyCommand,
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
import type { LocalState, ServerSettings } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'
import { getBaseOptionValues } from '../base-command.js'
import type { NetlifySite } from '../types.js'

import type { DevConfig } from './types.js'
import { doesProjectRequireLinkedSite } from '../../lib/extensions.js'

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
  state: LocalState
}) => {
  const { live } = options

  if (live) {
    const customSlug = typeof live === 'string' && live.length !== 0 ? live : undefined
    const slug = getLiveTunnelSlug(state, customSlug)

    let message = `${NETLIFYDEVWARN} Creating live URL with ID ${chalk.yellow(slug)}`

    if (!customSlug) {
      message += ` (to generate a custom URL, use ${chalk.magenta('--live=<subdomain>')})`
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

  const [needsLinkedSite, packagesRequiringLinkedSite] = await doesProjectRequireLinkedSite({
    options,
    project: command.project,
    site: command.netlify.site,
    siteInfo: command.netlify.siteInfo,
  })
  if (needsLinkedSite) {
    log(
      `Dependenc${packagesRequiringLinkedSite.length > 1 ? 'ies' : 'y'} ${packagesRequiringLinkedSite.join(
        ', ',
      )} require${
        packagesRequiringLinkedSite.length > 1 ? '' : 's'
      } a linked project, but you don't have one linked yet. Let's do that first.`,
    )
    const { init } = await import('../init/init.js')
    const { LINKED_NEW_SITE_EXIT_CODE, LINKED_EXISTING_SITE_EXIT_CODE } = await import('../init/constants.js')

    await init(getBaseOptionValues(options), command, {
      customizeExitMessage: (code, defaultMessage) => {
        switch (code) {
          case LINKED_NEW_SITE_EXIT_CODE:
          // fallthrough
          case LINKED_EXISTING_SITE_EXIT_CODE:
            return `${defaultMessage !== '' ? `${defaultMessage}\n` : ''}You can run ${chalk.cyanBright.bold(
              `${netlifyCommand()} dev`,
            )} again to start the local development server.`
        }
      },
      exitAfterConfiguringRepo: true,
    })
  }

  const blobsContext = await getBlobsContextWithEdgeAccess({
    debug: options.debug,
    projectRoot: command.workingDir,
    siteID: site.id ?? UNLINKED_SITE_MOCK_ID,
  })

  env[BLOBS_CONTEXT_VARIABLE] = { sources: ['internal'], value: encodeBlobsContext(blobsContext) }

  if (!options.offline && !options.offlineEnv) {
    env = await getEnvelopeEnv({ api, context: options.context, env, siteInfo })
    log(`${NETLIFYDEVLOG} Injecting environment variable values for ${chalk.yellow('all scopes')}`)
  }

  env = await getDotEnvVariables({ devConfig, env, site })
  injectEnvVariables(env)
  await promptEditorHelper({ chalk, config, log, NETLIFYDEVLOG, repositoryRoot, state })

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

  log(`${NETLIFYDEVLOG} Setting up local dev server`)

  const { configMutations, generatedFunctions } = await runDevTimeline({
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
    generatedFunctions,
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
  if (!options.skipGitignore) {
    try {
      await ensureNetlifyIgnore(repositoryRoot)
    } catch {
      // no-op
    }
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
