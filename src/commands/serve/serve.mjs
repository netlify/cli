// @ts-check
import process from 'process'

import { Option } from 'commander'

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
import { getSiteInformation, injectEnvVariables } from '../../utils/dev.mjs'
import { getEnvelopeEnv, normalizeContext } from '../../utils/env/index.mjs'
import { ensureNetlifyIgnore } from '../../utils/gitignore.mjs'
import openBrowser from '../../utils/open-browser.mjs'
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.mjs'
import { runBuildTimeline } from '../../utils/run-build.mjs'
import { getGeoCountryArgParser } from '../../utils/validation.mjs'

/**
 * The serve command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const serve = async (options, command) => {
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  /** @type {import('../dev/types').DevConfig} */
  const devConfig = {
    framework: '#auto',
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
    ...config.dev,
    ...options,
  }

  let { env } = cachedConfig

  // Override the `framework` value so that we start a static server and not
  // the framework's development server.
  devConfig.framework = '#static'

  if (!options.offline && siteInfo.use_envelope) {
    env = await getEnvelopeEnv({ api, context: options.context, env, siteInfo })
    log(`${NETLIFYDEVLOG} Injecting environment variable values for ${chalk.yellow('all scopes')}`)
  }

  await injectEnvVariables({ devConfig, env, site })
  await promptEditorHelper({ chalk, config, log, NETLIFYDEVLOG, repositoryRoot, state })

  const { addonsUrls, capabilities, siteUrl, timeouts } = await getSiteInformation({
    // inherited from base command --offline
    offline: options.offline,
    api,
    site,
    siteInfo,
  })

  /** @type {Partial<import('../../utils/types').ServerSettings>} */
  let settings = {}
  try {
    settings = await detectServerSettings(devConfig, options, site.root)

    cachedConfig.config = getConfigWithPlugins(cachedConfig.config, settings)
  } catch (error_) {
    log(NETLIFYDEVERR, error_.message)
    exit(1)
  }

  command.setAnalyticsPayload({ projectType: settings.framework || 'custom', live: options.live, graph: options.graph })

  log(`${NETLIFYDEVWARN} Building site for production`)

  const { configPath: configPathOverride } = await runBuildTimeline({ cachedConfig, options, settings, site })

  await startFunctionsServer({
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
  })

  // Try to add `.netlify` to `.gitignore`.
  try {
    await ensureNetlifyIgnore(repositoryRoot)
  } catch {
    // no-op
  }

  // TODO: We should consolidate this with the existing config watcher.
  const getUpdatedConfig = async () => {
    const cwd = options.cwd || process.cwd()
    const { config: newConfig } = await command.getConfig({ cwd, offline: true, state })
    const normalizedNewConfig = normalizeConfig(newConfig)

    return normalizedNewConfig
  }

  const inspectSettings = generateInspectSettings(options.edgeInspect, options.edgeInspectBrk)
  const url = await startProxyServer({
    addonsUrls,
    config,
    configPath: configPathOverride,
    env,
    geolocationMode: options.geo,
    geoCountry: options.country,
    getUpdatedConfig,
    inspectSettings,
    offline: options.offline,
    settings,
    site,
    siteInfo,
    state,
  })

  if (devConfig.autoLaunch !== false) {
    await openBrowser({ url, silentBrowserNoneError: true })
  }

  process.env.URL = url
  process.env.DEPLOY_URL = url

  printBanner({ url })
}

/**
 * Creates the `netlify serve` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createServeCommand = (program) =>
  program
    .command('serve')
    .description('(Beta) build the site for production and serve locally')
    .option(
      '--context <context>',
      'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
    )
    .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
    .option('--targetPort <port>', 'port of target app server', (value) => Number.parseInt(value))
    .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o ,--offline', 'disables any features that require network access')
    .option('--functionsPort <port>', 'port of functions server', (value) => Number.parseInt(value))
    .addOption(
      new Option(
        '--geo <mode>',
        'force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location',
      )
        .choices(['cache', 'mock', 'update'])
        .default('cache'),
    )
    .addOption(
      new Option(
        '--country <geoCountry>',
        'Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)',
      ).argParser(getGeoCountryArgParser('netlify dev --geo=mock --country=FR')),
    )
    .addOption(
      new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(),
    )
    .addExamples(['netlify serve', 'BROWSER=none netlify serve # disable browser auto opening'])
    .action(serve)
