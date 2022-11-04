// @ts-check
// @ts-expect-error TS(6200): Definitions of the following identifiers conflict ... Remove this comment to see the full error message
const events = require('events')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'promisify'... Remove this comment to see the full error message
const { promisify } = require('util')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'boxen'.
const boxen = require('boxen')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Option'.
const { Option } = require('commander')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const execa = require('execa')
const StaticServer = require('static-server')
const stripAnsiCc = require('strip-ansi-control-characters')
const waitPort = require('wait-port')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'promptEdit... Remove this comment to see the full error message
const { promptEditorHelper } = require('../../lib/edge-functions/index.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startFunct... Remove this comment to see the full error message
const { startFunctionsServer } = require('../../lib/functions/server.cjs')
const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'OneGraphCl... Remove this comment to see the full error message
  OneGraphCliClient,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'loadCLISes... Remove this comment to see the full error message
  loadCLISession,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'markCliSes... Remove this comment to see the full error message
  markCliSessionInactive,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'persistNew... Remove this comment to see the full error message
  persistNewOperationsDocForSession,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startOneGr... Remove this comment to see the full error message
  startOneGraphCLISession,
} = require('../../lib/one-graph/cli-client.cjs')
const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'defaultExa... Remove this comment to see the full error message
  defaultExampleOperationsDoc,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getGraphEd... Remove this comment to see the full error message
  getGraphEditUrlBySiteId,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getNetlify... Remove this comment to see the full error message
  getNetlifyGraphConfig,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readGraphQ... Remove this comment to see the full error message
  readGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startSpinn... Remove this comment to see the full error message
const { startSpinner, stopSpinner } = require('../../lib/spinner.cjs')
const {
  BANG,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
  NETLIFYDEVWARN,
  chalk,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'detectServ... Remove this comment to see the full error message
  detectServerSettings,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ensureNetl... Remove this comment to see the full error message
  ensureNetlifyIgnore,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
  error,
  exit,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'generateNe... Remove this comment to see the full error message
  generateNetlifyGraphJWT,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getEnvelop... Remove this comment to see the full error message
  getEnvelopeEnv,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getSiteInf... Remove this comment to see the full error message
  getSiteInformation,
  getToken,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'injectEnvV... Remove this comment to see the full error message
  injectEnvVariables,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
  log,
  normalizeConfig,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeC... Remove this comment to see the full error message
  normalizeContext,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'openBrowse... Remove this comment to see the full error message
  openBrowser,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'processOnE... Remove this comment to see the full error message
  processOnExit,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startLiveT... Remove this comment to see the full error message
  startLiveTunnel,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startProxy... Remove this comment to see the full error message
  startProxy,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
  warn,
  watchDebounced,
} = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createDevE... Remove this comment to see the full error message
const { createDevExecCommand } = require('./dev-exec.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'netlifyBui... Remove this comment to see the full error message
const netlifyBuildPromise = import('@netlify/build')

const startStaticServer = async ({
  settings
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const server = new StaticServer({
    rootPath: settings.dist,
    name: 'netlify-dev',
    port: settings.frameworkPort,
    templates: {
      notFound: path.join(settings.dist, '404.html'),
    },
  })

  await promisify(server.start.bind(server))()
  log(`\n${NETLIFYDEVLOG} Static server listening to`, settings.frameworkPort)
}

const isNonExistingCommandError = ({
  command,
  error: commandError
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  // `ENOENT` is only returned for non Windows systems
  // See https://github.com/sindresorhus/execa/pull/447
  if (commandError.code === 'ENOENT') {
    return true
  }

  // if the command is a package manager we let it report the error
  if (['yarn', 'npm'].includes(command)) {
    return false
  }

  // this only works on English versions of Windows
  return (
    typeof commandError.message === 'string' &&
    commandError.message.includes('is not recognized as an internal or external command')
  )
}

/**
 * @type {(() => Promise<void>)[]} - array of functions to run before the process exits
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const cleanupWork: $TSFixMe = []

let cleanupStarted = false

/**
 * @param {object} input
 * @param {number=} input.exitCode The exit code to return when exiting the process after cleanup
 */
const cleanupBeforeExit = async ({
  exitCode
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  // If cleanup has started, then wherever started it will be responsible for exiting
  if (!cleanupStarted) {
    cleanupStarted = true
    try {
      // @ts-expect-error TS(7006): Parameter 'cleanup' implicitly has an 'any' type.
      // eslint-disable-next-line no-unused-vars
      const cleanupFinished = await Promise.all(cleanupWork.map((cleanup) => cleanup()))
    } finally {
      process.exit(exitCode)
    }
  }
}

/**
 * Run a command and pipe stdout, stderr and stdin
 * @param {string} command
 * @param {NodeJS.ProcessEnv} env
 * @returns {execa.ExecaChildProcess<string>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const runCommand = (command: $TSFixMe, env = {}, spinner = null) => {
  const commandProcess = execa.command(command, {
    preferLocal: true,
    // we use reject=false to avoid rejecting synchronously when the command doesn't exist
    reject: false,
    env,
    // windowsHide needs to be false for child process to terminate properly on Windows
    windowsHide: false,
  })

  // This ensures that an active spinner stays at the bottom of the commandline
  // even though the actual framework command might be outputting stuff
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const pipeDataWithSpinner = (writeStream: $TSFixMe, chunk: $TSFixMe) => {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if (spinner && (spinner as $TSFixMe).isSpinning) {
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      (spinner as $TSFixMe).clear();
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      (spinner as $TSFixMe).isSilent = true;
    }
    writeStream.write(chunk, () => {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if (spinner && (spinner as $TSFixMe).isSpinning) {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        (spinner as $TSFixMe).isSilent = false;
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        (spinner as $TSFixMe).render();
    }
});
  }

  commandProcess.stdout.pipe(stripAnsiCc.stream()).on('data', pipeDataWithSpinner.bind(null, process.stdout))
  commandProcess.stderr.pipe(stripAnsiCc.stream()).on('data', pipeDataWithSpinner.bind(null, process.stderr))
  process.stdin.pipe(commandProcess.stdin)

  // we can't try->await->catch since we don't want to block on the framework server which
  // is a long running process
  // eslint-disable-next-line promise/catch-or-return
  commandProcess
    // eslint-disable-next-line promise/prefer-await-to-then
    .then(async () => {
      const result = await commandProcess
      const [commandWithoutArgs] = command.split(' ')
      if (result.failed && isNonExistingCommandError({ command: commandWithoutArgs, error: result })) {
        log(
          NETLIFYDEVERR,
          `Failed running command: ${command}. Please verify ${chalk.magenta(`'${commandWithoutArgs}'`)} exists`,
        )
      } else {
        const errorMessage = result.failed
          ? `${NETLIFYDEVERR} ${result.shortMessage}`
          : `${NETLIFYDEVWARN} "${command}" exited with code ${result.exitCode}`

        log(`${errorMessage}. Shutting down Netlify Dev server`)
      }

      return await cleanupBeforeExit({ exitCode: 1 })
    })
  processOnExit(async () => await cleanupBeforeExit({}))

  return commandProcess
}

/**
 * @typedef StartReturnObject
 * @property {4 | 6 | undefined=} ipVersion The version the open port was found on
 */

/**
 * Start a static server if the `useStaticServer` is provided or a framework specific server
 * @param {object} config
 * @param {Partial<import('../../utils/types').ServerSettings>} config.settings
 * @returns {Promise<StartReturnObject>}
 */
const startFrameworkServer = async function ({
  settings
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  if (settings.useStaticServer) {
    if (settings.command) {
      runCommand(settings.command, settings.env)
    }
    await startStaticServer({ settings })

    return {}
  }

  log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.framework || 'custom config'}`)

  const spinner = startSpinner({
    text: `Waiting for framework port ${settings.frameworkPort}. This can be configured using the 'targetPort' property in the netlify.toml`,
  })

  runCommand(settings.command, settings.env, spinner)

  let port
  try {
    port = await waitPort({
      port: settings.frameworkPort,
      host: 'localhost',
      output: 'silent',
      timeout: FRAMEWORK_PORT_TIMEOUT,
      ...(settings.pollingStrategies.includes('HTTP') && { protocol: 'http' }),
    })

    if (!port.open) {
      throw new Error(`Timed out waiting for port '${settings.frameworkPort}' to be open`)
    }

    stopSpinner({ error: false, spinner })
  } catch (error_) {
    stopSpinner({ error: true, spinner })
    log(NETLIFYDEVERR, `Netlify Dev could not start or connect to localhost:${settings.frameworkPort}.`)
    log(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`)
    error(error_)
    exit(1)
  }

  return { ipVersion: port?.ipVersion }
}

// 10 minutes
const FRAMEWORK_PORT_TIMEOUT = 6e5

/**
 * @typedef {Object} InspectSettings
 * @property {boolean} enabled - Inspect enabled
 * @property {boolean} pause - Pause on breakpoints
 * @property {string|undefined} address - Host/port override (optional)
 */

/**
 *
 * @param {object} params
 * @param {*} params.addonsUrls
 * @param {import('../base-command').NetlifyOptions["config"]} params.config
 * @param {import('../base-command').NetlifyOptions["cachedConfig"]['env']} params.env
 * @param {InspectSettings} params.inspectSettings
 * @param {() => Promise<object>} params.getUpdatedConfig
 * @param {string} params.geolocationMode
 * @param {string} params.geoCountry
 * @param {*} params.settings
 * @param {boolean} params.offline
 * @param {*} params.site
 * @param {*} params.siteInfo
 * @param {import('../../utils/state-config').StateConfig} params.state
 * @returns
 */
const startProxyServer = async ({
  addonsUrls,
  config,
  env,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  settings,
  site,
  siteInfo,
  state
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const url = await startProxy({
    addonsUrls,
    config,
    configPath: site.configPath,
    env,
    geolocationMode,
    geoCountry,
    getUpdatedConfig,
    inspectSettings,
    offline,
    projectDir: site.root,
    settings,
    state,
    siteInfo,
  })
  if (!url) {
    log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`)
    exit(1)
  }

  return url
}

/**
 *
 * @param {object} config
 * @param {*} config.api
 * @param {import('commander').OptionValues} config.options
 * @param {*} config.settings
 * @param {*} config.site
 * @returns
 */
const handleLiveTunnel = async ({
  api,
  options,
  settings,
  site
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'printBanne... Remove this comment to see the full error message
const printBanner = ({
  url
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const banner = chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${url}`)

  log(
    boxen(banner, {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: '#00c7b7',
    }),
  )
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const startPollingForAPIAuthentication = async function (options: $TSFixMe) {
  const { api, command, config, site, siteInfo } = options
  const frequency = 5000

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const helper = async (maybeSiteData: $TSFixMe) => {
    const siteData = await (maybeSiteData || api.getSite({ siteId: site.id }))
    const authlifyTokenId = siteData && siteData.authlify_token_id

    const existingAuthlifyTokenId = config && config.netlifyGraphConfig && config.netlifyGraphConfig.authlifyTokenId
    if (authlifyTokenId && authlifyTokenId !== existingAuthlifyTokenId) {
      const netlifyToken = await command.authenticate()
      // Only inject the authlify config if a token ID exists. This prevents
      // calling command.authenticate() (which opens a browser window) if the
      // user hasn't enabled API Authentication
      const netlifyGraphConfig = {
        netlifyToken,
        authlifyTokenId: siteData.authlify_token_id,
        siteId: site.id,
      }
      config.netlifyGraphConfig = netlifyGraphConfig

      const netlifyGraphJWT = generateNetlifyGraphJWT(netlifyGraphConfig)

      if (netlifyGraphJWT != null) {
        // XXX(anmonteiro): this name is deprecated. Delete after 3/31/2022
        process.env.ONEGRAPH_AUTHLIFY_TOKEN = netlifyGraphJWT
        process.env.NETLIFY_GRAPH_TOKEN = netlifyGraphJWT
      }
    } else if (!authlifyTokenId) {
      // If there's no `authlifyTokenId`, it's because the user disabled API
      // Auth. Delete the config in this case.
      delete config.netlifyGraphConfig
    }

    setTimeout(helper, frequency)
  }

  await helper(siteInfo)
}

/**
 * @param {boolean|string} edgeInspect
 * @param {boolean|string} edgeInspectBrk
 * @returns {InspectSettings}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const generateInspectSettings = (edgeInspect: $TSFixMe, edgeInspectBrk: $TSFixMe) => {
  const enabled = Boolean(edgeInspect) || Boolean(edgeInspectBrk)
  const pause = Boolean(edgeInspectBrk)
  const getAddress = () => {
    if (edgeInspect) {
      return typeof edgeInspect === 'string' ? edgeInspect : undefined
    }
    if (edgeInspectBrk) {
      return typeof edgeInspectBrk === 'string' ? edgeInspectBrk : undefined
    }
  }

  return {
    enabled,
    pause,
    address: getAddress(),
  }
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const validateShortFlagArgs = (args: $TSFixMe) => {
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

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const validateGeoCountryCode = (arg: $TSFixMe) => {
  // Validate that the arg passed is two letters only for country
  // See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
  if (!/^[a-z]{2}$/i.test(arg)) {
    throw new Error(
      `The geo country code must use a two letter abbreviation.
      ${chalk.red(BANG)}  Example:
      netlify dev --geo=mock --country=FR`,
    )
  }
  return arg.toUpperCase()
}

/**
 * The dev command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const dev = async (options: $TSFixMe, command: $TSFixMe) => {
  log(`${NETLIFYDEV}`)
  const { api, cachedConfig, config, repositoryRoot, site, siteInfo, state } = command.netlify
  const netlifyBuild = await netlifyBuildPromise
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

    // If there are plugins that we should be running for this site, add them
    // to the config as if they were declared in netlify.toml. We must check
    // whether the plugin has already been added by another source (like the
    // TOML file or the UI), as we don't want to run the same plugin twice.
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((settings as $TSFixMe).plugins) {
      const { plugins: existingPlugins = [] } = cachedConfig.config
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      const existingPluginNames = new Set(existingPlugins.map((plugin: $TSFixMe) => plugin.package))
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      const newPlugins = (settings as $TSFixMe).plugins
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .map((pluginName: $TSFixMe) => {
    if (existingPluginNames.has(pluginName)) {
        return;
    }
    return { package: pluginName, origin: 'config', inputs: {} };
})
    .filter(Boolean);

      cachedConfig.config.plugins = [...newPlugins, ...cachedConfig.config.plugins]
    }
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    log(NETLIFYDEVERR, (error_ as $TSFixMe).message);
    exit(1)
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  command.setAnalyticsPayload({ projectType: (settings as $TSFixMe).framework || 'custom', live: options.live, graph: options.graph });

  const startNetlifyGraphWatcher = Boolean(options.graph)
  if (startNetlifyGraphWatcher) {
    startPollingForAPIAuthentication({ api, command, config, site, siteInfo })
  }

  await startFunctionsServer({
    api,
    command,
    config,
    settings,
    site,
    siteInfo,
    siteUrl,
    capabilities,
    timeouts,
  })

  log(`${NETLIFYDEVWARN} Setting up local development server`)

  const devCommand = async () => {
    // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ipVersion'... Remove this comment to see the full error message
    const { ipVersion } = await startFrameworkServer({ settings })
    // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ipVersion'... Remove this comment to see the full error message
    // eslint-disable-next-line no-magic-numbers
(settings as $TSFixMe).frameworkHost = ipVersion === 6 ? '::1' : '127.0.0.1';
  }
  const startDevOptions = getBuildOptions({
    cachedConfig,
    options,
  })
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const { error: startDevError, success } = await (netlifyBuild as $TSFixMe).startDev(devCommand, startDevOptions);

  if (!success) {
    error(`Could not start local development server\n\n${startDevError.message}\n\n${startDevError.stack}`)
  }

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

  let url = await startProxyServer({
    addonsUrls,
    config,
    env: command.netlify.cachedConfig.env,
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

  const liveTunnelUrl = await handleLiveTunnel({ options, site, api, settings })
  url = liveTunnelUrl || url

  if (devConfig.autoLaunch !== false) {
    await openBrowser({ url, silentBrowserNoneError: true })
  }

  process.env.URL = url
  process.env.DEPLOY_URL = url

  if (startNetlifyGraphWatcher && options.offline) {
    warn(`Unable to start Netlify Graph in offline mode`)
  } else if (startNetlifyGraphWatcher && !site.id) {
    error(
      `No siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}.`,
    )
  } else if (startNetlifyGraphWatcher) {
    const netlifyToken = await command.authenticate()
    await OneGraphCliClient.ensureAppForSite(netlifyToken, site.id)

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    let stopWatchingCLISessions: $TSFixMe

    let liveConfig = { ...config }
    let isRestartingSession = false

    const createOrResumeSession = async function () {
      const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options, settings })

      let graphqlDocument = readGraphQLOperationsSourceFile(netlifyGraphConfig)

      if (!graphqlDocument || graphqlDocument.trim().length === 0) {
        graphqlDocument = defaultExampleOperationsDoc
      }

      stopWatchingCLISessions = await startOneGraphCLISession({
        config: liveConfig,
        netlifyGraphConfig,
        netlifyToken,
        site,
        state,
        oneGraphSessionId: options.sessionId,
      })

      // Should be created by startOneGraphCLISession
      const oneGraphSessionId = loadCLISession(state)

      await persistNewOperationsDocForSession({
        config: liveConfig,
        netlifyGraphConfig,
        netlifyToken,
        oneGraphSessionId,
        operationsDoc: graphqlDocument,
        siteId: site.id,
        siteRoot: site.root,
      })

      return oneGraphSessionId
    }

    const configWatcher = new events.EventEmitter()

    // Only set up a watcher if we know the config path.
    const { configPath } = command.netlify.site
    if (configPath) {
      // chokidar handle
      command.configWatcherHandle = await watchDebounced(configPath, {
        depth: 1,
        onChange: async () => {
          const cwd = options.cwd || process.cwd()
          const [token] = await getToken(options.auth)
          const { config: newConfig } = await command.getConfig({ cwd, state, token, ...command.netlify.apiUrlOpts })

          const normalizedNewConfig = normalizeConfig(newConfig)
          configWatcher.emit('change', normalizedNewConfig)
        },
      })

      processOnExit(async () => {
        await command.configWatcherHandle.close()
      })
    }

    // Set up a handler for config changes.
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    configWatcher.on('change', async (newConfig: $TSFixMe) => {
      command.netlify.config = newConfig
      liveConfig = newConfig
      if (isRestartingSession) {
        return
      }
      stopWatchingCLISessions && stopWatchingCLISessions()
      isRestartingSession = true
      await createOrResumeSession()
      isRestartingSession = false
    })

    const oneGraphSessionId = await createOrResumeSession()
    const cleanupSession = () => markCliSessionInactive({ netlifyToken, sessionId: oneGraphSessionId, siteId: site.id })

    cleanupWork.push(cleanupSession)

    const graphEditUrl = getGraphEditUrlBySiteId({ siteId: site.id, oneGraphSessionId })

    log(
      `Starting Netlify Graph session, to edit your library visit ${graphEditUrl} or run \`netlify graph:edit\` in another tab`,
    )
  }

  printBanner({ url })
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getBuildOp... Remove this comment to see the full error message
const getBuildOptions = ({
  cachedConfig,
  options: { context, cwd = process.cwd(), debug, dry, offline },
  token
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => ({
  cachedConfig,
  token,
  dry,
  debug,
  context,
  mode: 'cli',
  telemetry: false,
  buffer: false,
  offline,
  cwd,
})

/**
 * Creates the `netlify dev` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createDevC... Remove this comment to see the full error message
const createDevCommand = (program: $TSFixMe) => {
  createDevExecCommand(program)

  return program
    .command('dev')
    .alias('develop')
    .description(`Local dev server\nThe dev command will run a local dev server with Netlify's proxy and redirect rules`)
    .option('-c ,--command <command>', 'command to run')
    .option('--context <context>', 'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")', normalizeContext, 'dev')
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .option('-p ,--port <port>', 'port of netlify dev', (value: $TSFixMe) => Number.parseInt(value))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .option('--targetPort <port>', 'port of target app server', (value: $TSFixMe) => Number.parseInt(value))
    .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o ,--offline', 'disables any features that require network access')
    .option('-l, --live', 'start a public live session', false)
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .option('--functionsPort <port>', 'port of functions server', (value: $TSFixMe) => Number.parseInt(value))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('--geo <mode>', 'force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location') as $TSFixMe).choices(['cache', 'mock', 'update'])
    .default('cache'))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('--country <geoCountry>', 'Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)') as $TSFixMe).argParser(validateGeoCountryCode))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected') as $TSFixMe).argParser((value: $TSFixMe) => Number.parseInt(value))
    .hideHelp())
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('--graph', 'enable Netlify Graph support') as $TSFixMe).hideHelp())
    .addOption(new Option('--sessionId [sessionId]', '(Graph) connect to cloud session with ID [sessionId]'))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('-e, --edgeInspect [address]', 'enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format') as $TSFixMe).conflicts('edgeInspectBrk')
    .argParser(validateShortFlagArgs))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('-E, --edgeInspectBrk [address]', 'enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format') as $TSFixMe).conflicts('edgeInspect')
    .argParser(validateShortFlagArgs))
    .addExamples([
    'netlify dev',
    'netlify dev -d public',
    'netlify dev -c "hugo server -w" --targetPort 1313',
    'netlify dev --context production',
    'netlify dev --graph',
    'netlify dev --edgeInspect',
    'netlify dev --edgeInspect=127.0.0.1:9229',
    'netlify dev --edgeInspectBrk',
    'netlify dev --edgeInspectBrk=127.0.0.1:9229',
    'BROWSER=none netlify dev # disable browser auto opening',
])
    .action(dev);
}

module.exports = { createDevCommand }
