// @ts-check
const events = require('events')
const path = require('path')
const process = require('process')
const { promisify } = require('util')

const boxen = require('boxen')
const { Option } = require('commander')
const execa = require('execa')
const StaticServer = require('static-server')
const stripAnsiCc = require('strip-ansi-control-characters')
const waitPort = require('wait-port')

const { promptEditorHelper } = require('../../lib/edge-functions')
const { startFunctionsServer } = require('../../lib/functions/server')
const {
  OneGraphCliClient,
  loadCLISession,
  markCliSessionInactive,
  persistNewOperationsDocForSession,
  startOneGraphCLISession,
} = require('../../lib/one-graph/cli-client')
const {
  defaultExampleOperationsDoc,
  getGraphEditUrlBySiteId,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { startSpinner, stopSpinner } = require('../../lib/spinner')
const {
  BANG,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  detectServerSettings,
  error,
  exit,
  generateNetlifyGraphJWT,
  getSiteInformation,
  getToken,
  injectEnvVariables,
  log,
  normalizeConfig,
  openBrowser,
  processOnExit,
  startLiveTunnel,
  startProxy,
  warn,
  watchDebounced,
} = require('../../utils')

const { createDevExecCommand } = require('./dev-exec')

const startStaticServer = async ({ settings }) => {
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

const isNonExistingCommandError = ({ command, error: commandError }) => {
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
const cleanupWork = []

let cleanupStarted = false

/**
 * @param {object} input
 * @param {number=} input.exitCode The exit code to return when exiting the process after cleanup
 */
const cleanupBeforeExit = async ({ exitCode }) => {
  // If cleanup has started, then wherever started it will be responsible for exiting
  if (!cleanupStarted) {
    cleanupStarted = true
    try {
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
const runCommand = (command, env = {}, spinner = null) => {
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
  const pipeDataWithSpinner = (writeStream, chunk) => {
    if (spinner && spinner.isSpinning) {
      spinner.clear()
      spinner.isSilent = true
    }
    writeStream.write(chunk, () => {
      if (spinner && spinner.isSpinning) {
        spinner.isSilent = false
        spinner.render()
      }
    })
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
 * Start a static server if the `useStaticServer` is provided or a framework specific server
 * @param {object} config
 * @param {Partial<import('../../utils/types').ServerSettings>} config.settings
 * @returns {Promise<void>}
 */
const startFrameworkServer = async function ({ settings }) {
  if (settings.useStaticServer) {
    if (settings.command) {
      runCommand(settings.command, settings.env)
    }
    return await startStaticServer({ settings })
  }

  log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.framework || 'custom config'}`)

  const spinner = startSpinner({
    text: `Waiting for framework port ${settings.frameworkPort}. This can be configured using the 'targetPort' property in the netlify.toml`,
  })

  runCommand(settings.command, settings.env, spinner)

  try {
    const open = await waitPort({
      port: settings.frameworkPort,
      output: 'silent',
      timeout: FRAMEWORK_PORT_TIMEOUT,
      ...(settings.pollingStrategies.includes('HTTP') && { protocol: 'http' }),
    })

    if (!open) {
      throw new Error(`Timed out waiting for port '${settings.frameworkPort}' to be open`)
    }

    stopSpinner({ error: false, spinner })
  } catch {
    stopSpinner({ error: true, spinner })
    log(NETLIFYDEVERR, `Netlify Dev could not connect to localhost:${settings.frameworkPort}.`)
    log(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`)
    exit(1)
  }
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
 * @param {InspectSettings} params.inspectSettings
 * @param {() => Promise<object>} params.getUpdatedConfig
 * @param {string} params.geolocationMode
 * @param {*} params.settings
 * @param {boolean} params.offline
 * @param {*} params.site
 * @param {import('../../utils/state-config').StateConfig} params.state
 * @returns
 */
const startProxyServer = async ({
  addonsUrls,
  config,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  settings,
  site,
  state,
}) => {
  const url = await startProxy({
    addonsUrls,
    config,
    configPath: site.configPath,
    geolocationMode,
    getUpdatedConfig,
    inspectSettings,
    offline,
    projectDir: site.root,
    settings,
    state,
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

const printBanner = ({ url }) => {
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

const startPollingForAPIAuthentication = async function (options) {
  const { api, command, config, site, siteInfo } = options
  const frequency = 5000

  const helper = async (maybeSiteData) => {
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
const generateInspectSettings = (edgeInspect, edgeInspectBrk) => {
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
 * @param {import('../base-command').BaseCommand} command
 */
const dev = async (options, command) => {
  log(`${NETLIFYDEV}`)
  const { api, config, repositoryRoot, site, siteInfo, state } = command.netlify
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

  await injectEnvVariables({ devConfig, env: command.netlify.cachedConfig.env, site })
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
  } catch (error_) {
    log(NETLIFYDEVERR, error_.message)
    exit(1)
  }

  command.setAnalyticsPayload({ projectType: settings.framework || 'custom', live: options.live, graph: options.graph })

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
  await startFrameworkServer({ settings })

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
    geolocationMode: options.geo,
    getUpdatedConfig,
    inspectSettings,
    offline: options.offline,
    settings,
    site,
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

    let stopWatchingCLISessions

    const createOrResumeSession = async function () {
      const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options, settings })

      let graphqlDocument = readGraphQLOperationsSourceFile(netlifyGraphConfig)

      if (!graphqlDocument || graphqlDocument.trim().length === 0) {
        graphqlDocument = defaultExampleOperationsDoc
      }

      stopWatchingCLISessions = await startOneGraphCLISession({ netlifyGraphConfig, netlifyToken, site, state })

      // Should be created by startOneGraphCLISession
      const oneGraphSessionId = loadCLISession(state)

      await persistNewOperationsDocForSession({
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
    configWatcher.on('change', (newConfig) => {
      command.netlify.config = newConfig
      stopWatchingCLISessions()
      createOrResumeSession()
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

/**
 * Creates the `netlify dev` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createDevCommand = (program) => {
  createDevExecCommand(program)

  return program
    .command('dev')
    .description(
      `Local dev server\nThe dev command will run a local dev server with Netlify's proxy and redirect rules`,
    )
    .option('-c ,--command <command>', 'command to run')
    .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
    .option('--targetPort <port>', 'port of target app server', (value) => Number.parseInt(value))
    .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o ,--offline', 'disables any features that require network access')
    .option('-l, --live', 'start a public live session', false)
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
      new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(),
    )
    .addOption(new Option('--graph', 'enable Netlify Graph support').hideHelp())
    .addOption(
      new Option(
        '-e, --edgeInspect [address]',
        'enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format',
      )
        .conflicts('edgeInspectBrk')
        .argParser(validateShortFlagArgs),
    )
    .addOption(
      new Option(
        '-E, --edgeInspectBrk [address]',
        'enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format',
      )
        .conflicts('edgeInspect')
        .argParser(validateShortFlagArgs),
    )
    .addExamples([
      'netlify dev',
      'netlify dev -d public',
      'netlify dev -c "hugo server -w" --targetPort 1313',
      'netlify dev --graph',
      'netlify dev --edgeInspect',
      'netlify dev --edgeInspect=127.0.0.1:9229',
      'netlify dev --edgeInspectBrk',
      'netlify dev --edgeInspectBrk=127.0.0.1:9229',
      'BROWSER=none netlify dev # disable browser auto opening',
    ])
    .action(dev)
}

module.exports = { createDevCommand }
