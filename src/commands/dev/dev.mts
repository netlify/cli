import process from 'process'

import { OptionValues } from 'commander'

import { getBlobsContext } from '../../lib/blobs/blobs.mjs'
import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.mjs'
import { startFunctionsServer } from '../../lib/functions/server.mjs'
import { printBanner } from '../../utils/banner.mjs'
import {
  chalk,
  log,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  normalizeConfig,
} from '../../utils/command-helpers.mjs'
import detectServerSettings, { getConfigWithPlugins } from '../../utils/detect-server-settings.mjs'
import { getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.mjs'
import { getEnvelopeEnv } from '../../utils/env/index.mjs'
import { ensureNetlifyIgnore } from '../../utils/gitignore.mjs'
import { getLiveTunnelSlug, startLiveTunnel } from '../../utils/live-tunnel.mjs'
import openBrowser from '../../utils/open-browser.mjs'
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.mjs'
import { getProxyUrl } from '../../utils/proxy.mjs'
import { runDevTimeline } from '../../utils/run-build.mjs'
import BaseCommand from '../base-command.mjs'


/**
 *
 * @param {object} config
 * @param {*} config.api
 * @param {import('commander').OptionValues} config.options
 * @param {import('../../utils/types.js').ServerSettings} config.settings
 * @param {*} config.site
 * @param {*} config.state
 * @returns
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const handleLiveTunnel = async ({ api, options, settings, site, state }) => {
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
  log(`${NETLIFYDEV}`)
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  /** @type {import('./types.js').DevConfig} */
  const devConfig = {
    framework: '#auto',
    autoLaunch: Boolean(options.open),
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
    ...(config.build.base && { base: config.build.base }),
    ...config.dev,
    ...options,
  }

  let { env } = cachedConfig

  env.NETLIFY_DEV = { sources: ['internal'], value: 'true' }

  if (!options.offline && siteInfo.use_envelope) {
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

  /** @type {import('../../utils/types.js').ServerSettings} */
  let settings
  try {
    settings = await detectServerSettings(devConfig, options, command)

    cachedConfig.config = getConfigWithPlugins(cachedConfig.config, settings)
  } catch (error_) {
    if (error_ && typeof error_ === 'object' && 'message' in error_) {
      log(NETLIFYDEVERR, error_.message)
    }
    process.exit(1)
  }

  command.setAnalyticsPayload({ live: options.live })

  const liveTunnelUrl = await handleLiveTunnel({ options, site, api, settings, state })
  const url = liveTunnelUrl || getProxyUrl(settings)

  process.env.URL = url
  process.env.DEPLOY_URL = url

  log(`${NETLIFYDEVWARN} Setting up local development server`)

  const { configPath: configPathOverride } = await runDevTimeline({
    command,
    options,
    settings,
    env: {
      URL: url,
      DEPLOY_URL: url,
    },
  })

  const blobsContext = await getBlobsContext({
    debug: options.debug,
    projectRoot: command.workingDir,
    siteID: site.id ?? 'unknown-site-id',
  })

  const functionsRegistry = await startFunctionsServer({
    api,
    blobsContext,
    command,
    config,
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
  const getUpdatedConfig = async () => {
    const { config: newConfig } = await command.getConfig({
      cwd: command.workingDir,
      offline: true,
      state,
    })
    const normalizedNewConfig = normalizeConfig(newConfig)

    return normalizedNewConfig
  }

  const inspectSettings = generateInspectSettings(options.edgeInspect, options.edgeInspectBrk)

  await startProxyServer({
    addonsUrls,
    blobsContext,
    config,
    configPath: configPathOverride,
    debug: options.debug,
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
