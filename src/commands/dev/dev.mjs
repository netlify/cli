// @ts-check
import process from 'process'

import { Option } from 'commander'

import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.mjs'
import { startFunctionsServer } from '../../lib/functions/server.mjs'
import { printBanner } from '../../utils/banner.mjs'
import {
  BANG,
  chalk,
  exit,
  log,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  normalizeConfig,
} from '../../utils/command-helpers.mjs'
import detectServerSettings, { getConfigWithPlugins } from '../../utils/detect-server-settings.mjs'
import { getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.mjs'
import { getEnvelopeEnv, normalizeContext } from '../../utils/env/index.mjs'
import { ensureNetlifyIgnore } from '../../utils/gitignore.mjs'
import { startLiveTunnel } from '../../utils/live-tunnel.mjs'
import openBrowser from '../../utils/open-browser.mjs'
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.mjs'
import { getProxyUrl } from '../../utils/proxy.mjs'
import { runDevTimeline } from '../../utils/run-build.mjs'
import { getGeoCountryArgParser } from '../../utils/validation.mjs'

import { createDevExecCommand } from './dev-exec.mjs'

/**
 *
 * @param {object} config
 * @param {*} config.api
 * @param {import('commander').OptionValues} config.options
 * @param {*} config.settings
 * @param {*} config.site
 * @returns
 */
const handleLiveTunnel = async ({ api, options, settings, site }) => {
  if (options.live) {
    const sessionUrl = await startLiveTunnel({
      siteId: site.id,
      netlifyApiToken: api.accessToken,
      localPort: settings.port,
    })
    process.env.BASE_URL = sessionUrl
    return sessionUrl
  }
}

const validateShortFlagArgs = (args) => {
  if (args.startsWith('=')) {
    throw new Error(
      `Short flag options like -e or -E don't support the '=' sign
 ${chalk.red(BANG)}   Supported formats:
      netlify dev -e
      netlify dev -e 127.0.0.1:9229
      netlify dev -e127.0.0.1:9229
      netlify dev -E
      netlify dev -E 127.0.0.1:9229
      netlify dev -E127.0.0.1:9229`,
    )
  }
  return args
}

/**
 * The dev command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const dev = async (options, command) => {
  log(`${NETLIFYDEV}`)
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  /** @type {import('./types').DevConfig} */
  const devConfig = {
    framework: '#auto',
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
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
    settings = await detectServerSettings(devConfig, options, site.root, {
      site: {
        id: site.id,
        url: siteUrl,
      },
    })

    cachedConfig.config = getConfigWithPlugins(cachedConfig.config, settings)
  } catch (error_) {
    log(NETLIFYDEVERR, error_.message)
    exit(1)
  }

  command.setAnalyticsPayload({ projectType: settings.framework || 'custom', live: options.live })

  const liveTunnelUrl = await handleLiveTunnel({ options, site, api, settings })
  const url = liveTunnelUrl || getProxyUrl(settings)
  process.env.URL = url
  process.env.DEPLOY_URL = url

  log(`${NETLIFYDEVWARN} Setting up local development server`)

  const { configPath: configPathOverride } = await runDevTimeline({
    cachedConfig,
    options,
    settings,
    site,
    env: {
      URL: url,
      DEPLOY_URL: url,
    },
  })

  await startFunctionsServer({
    api,
    command,
    config,
    debug: options.debug,
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

  await startProxyServer({
    addonsUrls,
    config,
    configPath: configPathOverride,
    debug: options.debug,
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

  printBanner({ url })
}

/**
 * Creates the `netlify dev` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createDevCommand = (program) => {
  createDevExecCommand(program)

  return program
    .command('dev')
    .alias('develop')
    .description(
      `Local dev server\nThe dev command will run a local dev server with Netlify's proxy and redirect rules`,
    )
    .option('-c ,--command <command>', 'command to run')
    .option(
      '--context <context>',
      'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
    )
    .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
    .addOption(
      new Option('--targetPort <port>', 'Old, prefer --target-port. Port of target app server')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(true),
    )
    .option('--target-port <port>', 'port of target app server', (value) => Number.parseInt(value))
    .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o ,--offline', 'disables any features that require network access')
    .option('-l, --live', 'start a public live session', false)
    .addOption(
      new Option('--functionsPort <port>', 'Old, prefer --functions-port. Port of functions server')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(true),
    )
    .option('--functions-port <port>', 'port of functions server', (value) => Number.parseInt(value))
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
    .addOption(
      new Option(
        '-e, --edgeInspect [address]',
        'Old, prefer --edge-inspect. Enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format',
      )
        .conflicts('edgeInspectBrk')
        .argParser(validateShortFlagArgs)
        .hideHelp(true),
    )
    .addOption(
      new Option(
        '-e, --edge-inspect [address]',
        'enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format',
      )
        .conflicts('edgeInspectBrk')
        .argParser(validateShortFlagArgs),
    )
    .addOption(
      new Option(
        '-E, --edgeInspectBrk [address]',
        'Old, prefer --edge-inspect-brk. Enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format',
      )
        .conflicts('edgeInspect')
        .hideHelp(true)
        .argParser(validateShortFlagArgs),
    )
    .addOption(
      new Option(
        '-E, --edge-inspect-brk [address]',
        'enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format',
      )
        .conflicts('edgeInspect')
        .argParser(validateShortFlagArgs),
    )
    .addExamples([
      'netlify dev',
      'netlify dev -d public',
      'netlify dev -c "hugo server -w" --target-port 1313',
      'netlify dev --context production',
      'netlify dev --edge-inspect',
      'netlify dev --edge-inspect=127.0.0.1:9229',
      'netlify dev --edge-inspect-brk',
      'netlify dev --edge-inspect-brk=127.0.0.1:9229',
      'BROWSER=none netlify dev # disable browser auto opening',
    ])
    .action(dev)
}
