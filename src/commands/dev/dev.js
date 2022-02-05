// @ts-check
const path = require('path')
const process = require('process')
const { promisify } = require('util')

const boxen = require('boxen')
const { Option } = require('commander')
const execa = require('execa')
const StaticServer = require('static-server')
const stripAnsiCc = require('strip-ansi-control-characters')
const waitPort = require('wait-port')

const { startFunctionsServer } = require('../../lib/functions/server')
const {
  OneGraphCliClient,
  loadCLISession,
  persistNewOperationsDocForSession,
  startOneGraphCLISession,
} = require('../../lib/one-graph/cli-client')
const {
  defaultExampleOperationsDoc,
  getGraphEditUrlBySiteId,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const {
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  detectServerSettings,
  error,
  exit,
  generateAuthlifyJWT,
  getSiteInformation,
  injectEnvVariables,
  log,
  openBrowser,
  startForwardProxy,
  startLiveTunnel,
  startProxy,
  warn,
} = require('../../utils')

const { createDevExecCommand } = require('./dev-exec')
const { createDevTraceCommand } = require('./dev-trace')

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
 * Run a command and pipe stdout, stderr and stdin
 * @param {string} command
 * @param {NodeJS.ProcessEnv} env
 * @returns {execa.ExecaChildProcess<string>}
 */
const runCommand = (command, env = {}) => {
  const commandProcess = execa.command(command, {
    preferLocal: true,
    // we use reject=false to avoid rejecting synchronously when the command doesn't exist
    reject: false,
    env,
    // windowsHide needs to be false for child process to terminate properly on Windows
    windowsHide: false,
  })

  commandProcess.stdout.pipe(stripAnsiCc.stream()).pipe(process.stdout)
  commandProcess.stderr.pipe(stripAnsiCc.stream()).pipe(process.stderr)
  process.stdin.pipe(commandProcess.stdin)

  // we can't try->await->catch since we don't want to block on the framework server which
  // is a long running process
  // eslint-disable-next-line promise/catch-or-return,promise/prefer-await-to-then
  commandProcess.then(async () => {
    const result = await commandProcess
    const [commandWithoutArgs] = command.split(' ')
    // eslint-disable-next-line promise/always-return
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
    process.exit(1)
  })
  ;['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach((signal) => {
    process.on(signal, () => {
      commandProcess.kill('SIGTERM', { forceKillAfterTimeout: 500 })
      process.exit()
    })
  })

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

  runCommand(settings.command, settings.env)

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
  } catch {
    log(NETLIFYDEVERR, `Netlify Dev could not connect to localhost:${settings.frameworkPort}.`)
    log(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`)
    exit(1)
  }
}

// 10 minutes
const FRAMEWORK_PORT_TIMEOUT = 6e5

/**
 *
 * @param {object} config
 * @param {*} config.addonsUrls
 * @param {import('commander').OptionValues} config.options
 * @param {*} config.settings
 * @param {*} config.site
 * @returns
 */
const startProxyServer = async ({ addonsUrls, options, settings, site }) => {
  let url
  if (options.edgeHandlers || options.trafficMesh) {
    url = await startForwardProxy({
      port: settings.port,
      frameworkPort: settings.frameworkPort,
      functionsPort: settings.functionsPort,
      publishDir: settings.dist,
      debug: options.debug,
      locationDb: options.locationDb,
      jwtRolesPath: settings.jwtRolePath,
      jwtSecret: settings.jwtSecret,
    })
    if (!url) {
      log(NETLIFYDEVERR, `Unable to start forward proxy on port '${settings.port}'`)
      exit(1)
    }
  } else {
    url = await startProxy(settings, addonsUrls, site.configPath, site.root)
    if (!url) {
      log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`)
      exit(1)
    }
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

/**
 * The dev command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const dev = async (options, command) => {
  log(`${NETLIFYDEV}`)
  const { api, config, site, siteInfo, state } = command.netlify
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

  if (options.trafficMesh) {
    warn(
      '--trafficMesh and -t are deprecated and will be removed in the near future. Please use --edgeHandlers or -e instead.',
    )
  }

  const startNetlifyGraphWatcher = Boolean(options.graph)
  let authlifyJWT

  if (startNetlifyGraphWatcher) {
    const netlifyToken = await command.authenticate()
    authlifyJWT = generateAuthlifyJWT(netlifyToken, siteInfo.authlify_token_id, site.id)
  }

  await injectEnvVariables({
    env: Object.assign(
      command.netlify.cachedConfig.env,
      authlifyJWT == null
        ? {}
        : {
            ONEGRAPH_AUTHLIFY_TOKEN: {
              sources: ['general'],
              value: authlifyJWT,
            },
          },
    ),
    site,
  })

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

  command.setAnalyticsPayload({ projectType: settings.framework || 'custom', live: options.live })

  let configWithAuthlify

  if (siteInfo.authlify_token_id) {
    const netlifyToken = command.authenticate()
    // Only inject the authlify config if a token ID exists. This prevents
    // calling command.authenticate() (which opens a browser window) if the
    // user hasn't enabled API Authentication
    configWithAuthlify = Object.assign(config, {
      authlify: {
        netlifyToken,
        authlifyTokenId: siteInfo.authlify_token_id,
        siteId: site.id,
      },
    })
  } else {
    configWithAuthlify = config
  }

  await startFunctionsServer({
    config: configWithAuthlify,
    settings,
    site,
    siteUrl,
    capabilities,
    timeouts,
  })
  await startFrameworkServer({ settings })

  let url = await startProxyServer({ options, settings, site, addonsUrls })

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
    const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options, settings })

    let graphqlDocument = readGraphQLOperationsSourceFile(netlifyGraphConfig)

    if (!graphqlDocument || graphqlDocument.trim().length === 0) {
      graphqlDocument = defaultExampleOperationsDoc
    }

    await startOneGraphCLISession({ netlifyGraphConfig, netlifyToken, site, state })

    // Should be created by startOneGraphCLISession
    const oneGraphSessionId = loadCLISession(state)

    await persistNewOperationsDocForSession({
      netlifyToken,
      oneGraphSessionId,
      operationsDoc: graphqlDocument,
      siteId: site.id,
    })

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
  createDevTraceCommand(program)

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
      new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(),
    )
    .addOption(new Option('-e ,--edgeHandlers', 'activates the Edge Handlers runtime').hideHelp())
    .addOption(
      new Option(
        '-t ,--trafficMesh',
        '(DEPRECATED: use --edgeHandlers or -e instead) uses Traffic Mesh for proxying requests',
      ).hideHelp(),
    )
    .addOption(
      new Option(
        '-g ,--locationDb <path>',
        'specify the path to a local GeoIP location database in MMDB format',
      ).hideHelp(),
    )
    .addOption(new Option('--graph', 'enable Netlify Graph support').hideHelp())
    .addExamples([
      'netlify dev',
      'netlify dev -d public',
      'netlify dev -c "hugo server -w" --targetPort 1313',
      'BROWSER=none netlify dev # disable browser auto opening',
    ])
    .action(dev)
}
module.exports = { createDevCommand }
