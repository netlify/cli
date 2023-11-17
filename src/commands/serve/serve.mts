import process from 'process'

import { OptionValues } from 'commander'

import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.mjs'
import { startFunctionsServer } from '../../lib/functions/server.mjs'
import { printBanner } from '../../utils/banner.mjs'
import {
  chalk,
  exit,
  log,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  normalizeConfig,
} from '../../utils/command-helpers.mjs'
import detectServerSettings, { getConfigWithPlugins } from '../../utils/detect-server-settings.mjs'
import { getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.mjs'
import { getEnvelopeEnv } from '../../utils/env/index.mjs'
import { getInternalFunctionsDir } from '../../utils/functions/functions.mjs'
import { ensureNetlifyIgnore } from '../../utils/gitignore.mjs'
import openBrowser from '../../utils/open-browser.mjs'
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.mjs'
import { runBuildTimeline } from '../../utils/run-build.mjs'
import BaseCommand from '../base-command.mjs'

export const serve = async (options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  /** @type {import('../dev/types').DevConfig} */
  const devConfig = {
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),

    ...config.dev,
    ...options,
    // Override the `framework` value so that we start a static server and not
    // the framework's development server.
    framework: '#static',
  }

  let { env } = cachedConfig

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

  // Ensure the internal functions directory exists so that the functions
  // server and registry are initialized, and any functions created by
  // Netlify Build are loaded.
  await getInternalFunctionsDir({ base: site.root, ensureExists: true })

  let settings = /** @type {import('../../utils/types.js').ServerSettings} */ {}
  try {
    settings = await detectServerSettings(devConfig, options, command)

    cachedConfig.config = getConfigWithPlugins(cachedConfig.config, settings)
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    log(NETLIFYDEVERR, error_.message)
    exit(1)
  }

  command.setAnalyticsPayload({ live: options.live })

  log(`${NETLIFYDEVLOG} Building site for production`)
  log(
    `${NETLIFYDEVWARN} Changes will not be hot-reloaded, so if you need to rebuild your site you must exit and run 'netlify serve' again`,
  )

  const { configPath: configPathOverride } = await runBuildTimeline({
    command,
    settings,
    options,
  })

  const functionsRegistry = await startFunctionsServer({
    api,
    command,
    config,
    debug: options.debug,
    loadDistFunctions: true,
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
    const { config: newConfig } = await command.getConfig({ cwd: command.workingDir, offline: true, state })
    const normalizedNewConfig = normalizeConfig(newConfig)

    return normalizedNewConfig
  }

  const inspectSettings = generateInspectSettings(options.edgeInspect, options.edgeInspectBrk)
  // @ts-expect-error TS(2345) FIXME: Argument of type '{ addonsUrls: { [k: string]: any... Remove this comment to see the full error message
  const url = await startProxyServer({
    addonsUrls,
    config,
    configPath: configPathOverride,
    debug: options.debug,
    env,
    functionsRegistry,
    geolocationMode: options.geo,
    geoCountry: options.country,
    getUpdatedConfig,
    inspectSettings,
    offline: options.offline,
    projectDir: command.workingDir,
    settings,
    site,
    siteInfo,
    state,
    accountId,
  })

  if (devConfig.autoLaunch !== false) {
    await openBrowser({ url, silentBrowserNoneError: true })
  }

  process.env.URL = url
  process.env.DEPLOY_URL = url

  printBanner({ url })
}
