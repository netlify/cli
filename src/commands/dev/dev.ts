import process from 'process'

import { applyMutations } from '@netlify/config'
import { Option, OptionValues } from 'commander'

import { BLOBS_CONTEXT_VARIABLE, encodeBlobsContext, getBlobsContextWithEdgeAccess } from '../../lib/blobs/blobs.js'
import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.js'
import { startFunctionsServer } from '../../lib/functions/server.js'
import { printBanner } from '../../utils/banner.js'
import {
  BANG,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  log,
  normalizeConfig,
} from '../../utils/command-helpers.js'
import detectServerSettings, { getConfigWithPlugins } from '../../utils/detect-server-settings.js'
import { UNLINKED_SITE_MOCK_ID, getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv, normalizeContext } from '../../utils/env/index.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { getLiveTunnelSlug, startLiveTunnel } from '../../utils/live-tunnel.js'
import openBrowser from '../../utils/open-browser.js'
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.js'
import { getProxyUrl } from '../../utils/proxy.js'
import { runDevTimeline } from '../../utils/run-build.js'
import { getGeoCountryArgParser } from '../../utils/validation.js'
import BaseCommand from '../base-command.js'

import { createDevExecCommand } from './dev-exec.js'
import { type DevConfig } from './types.js'

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

const validateShortFlagArgs = (args: string) => {
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

export const dev = async (options: OptionValues, command: BaseCommand) => {
  log(NETLIFYDEV)
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  const devConfig: DevConfig = {
    framework: '#auto',
    autoLaunch: Boolean(options.open),
    ...(cachedConfig.siteInfo?.dev_server_settings && {
      command: cachedConfig.siteInfo.dev_server_settings.cmd,
      targetPort: cachedConfig.siteInfo.dev_server_settings.target_port,
    }),
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
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

    const { NETLIFY_INCLUDE_DEV_SERVER_PLUGIN } = process.env

    if (NETLIFY_INCLUDE_DEV_SERVER_PLUGIN) {
      const plugins = NETLIFY_INCLUDE_DEV_SERVER_PLUGIN.split(',')
      if (options.debug) {
        log(`${NETLIFYDEVLOG} Including dev server plugins: ${NETLIFY_INCLUDE_DEV_SERVER_PLUGIN}`)
      }
      settings.plugins = [...(settings.plugins || []), ...plugins]
    }

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

  const { configMutations, configPath: configPathOverride } = await runDevTimeline({
    command,
    options,
    settings,
    env: {
      URL: url,
      DEPLOY_URL: url,
    },
  })

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
  const getUpdatedConfig = async () => {
    const { config: newConfig } = await command.getConfig({
      cwd: command.workingDir,
      offline: true,
    })
    const normalizedNewConfig = normalizeConfig(newConfig)

    return normalizedNewConfig
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

export const createDevCommand = (program: BaseCommand) => {
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
    .addOption(new Option('--skip-wait-port', 'disables waiting for target port to become available').hideHelp(true))
    .addOption(new Option('--no-open', 'disables the automatic opening of a browser window'))
    .option('--target-port <port>', 'port of target app server', (value) => Number.parseInt(value))
    .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o, --offline', 'Disables any features that require network access')
    .addOption(
      new Option('--offline-env', 'disables fetching environment variables from the Netlify API').hideHelp(true),
    )
    .addOption(
      new Option(
        '--internal-disable-edge-functions',
        "disables edge functions. use this if your environment doesn't support Deno. This option is internal and should not be used by end users.",
      ).hideHelp(true),
    )
    .option(
      '-l, --live [subdomain]',
      'start a public live session; optionally, supply a subdomain to generate a custom URL',
      false,
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
        '-e, --edge-inspect [address]',
        'enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format',
      )
        .conflicts('edgeInspectBrk')
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
