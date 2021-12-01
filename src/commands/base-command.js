// @ts-check
const process = require('process')
const { format } = require('util')

const resolveConfig = require('@netlify/config')
const { Command } = require('commander')
const debug = require('debug')
const merge = require('lodash/merge')

// TODO: use static `import` after migrating this repository to pure ES modules
const jsClient = import('netlify')

const { getAgent } = require('../lib/http-agent')
const {
  StateConfig,
  USER_AGENT,
  chalk,
  error,
  exit,
  getGlobalConfig,
  getToken,
  identify,
  log,
  normalizeConfig,
  openBrowser,
  pollForToken,
  track,
} = require('../utils')

// Netlify CLI client id. Lives in bot@netlify.com
// TODO: setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

const NANO_SECS_TO_MSECS = 1e6

/**
 * Get the duration between a start time and the current time
 * @param {bigint} startTime
 * @returns
 */
const getDuration = function (startTime) {
  const durationNs = process.hrtime.bigint() - startTime
  return Math.round(Number(durationNs / BigInt(NANO_SECS_TO_MSECS)))
}

/**
 * The netlify object inside each command with the state
 * @typedef NetlifyOptions
 * @type {object}
 * @property {import('netlify').NetlifyAPI} api
 * @property {*} repositoryRoot
 * @property {object} site
 * @property {*} site.root
 * @property {*} site.configPath
 * @property {*} site.id
 * @property {*} siteInfo
 * @property {*} config
 * @property {*} cachedConfig
 * @property {*} globalConfig
 * @property {StateConfig} state,
 */

/** Base command class that provides tracking and config initialization */
class BaseCommand extends Command {
  /** @type {NetlifyOptions} */
  netlify

  /** @type {{ startTime: bigint, payload?: any}} */
  analytics = { startTime: process.hrtime.bigint() }

  /**
   * IMPORTANT this function will be called for each command!
   * Don't do anything expensive in there.
   * @param {string} name The command name
   * @returns
   */
  createCommand(name) {
    return (
      new BaseCommand(name)
        // If  --silent or --json flag passed disable logger
        .option('--json')
        .option('--cwd <cwd>', 'Pass a current working directory.')
        .option('-o, --offline')

        // Allow hidden flags like
        // --json,
        // --silent,
        // --offline, -o
        // --cwd <cwd> Pass a current working directory.

        // this disables the suggestions
        // .allowUnknownOption(true)

        .option('--debug', 'Print debugging information')
        .option(
          '--httpProxy',
          'Proxy server address to route requests through',
          process.env.HTTP_PROXY || process.env.HTTPS_PROXY,
        )
        .option(
          '--httpProxyCertificateFilename',
          'Certificate file to use when connecting using a proxy server',
          process.env.NETLIFY_PROXY_CERTIFICATE_FILENAME,
        )
        .hook('preAction', async (_parentCommand, actionCommand) => {
          debug(`${name}:preAction`)('start')
          this.analytics = { startTime: process.hrtime.bigint() }
          // @ts-ignore cannot type actionCommand as BaseCommand
          await this.init(actionCommand)
          debug(`${name}:preAction`)('end')
        })
    )
  }

  /**
   * Will be called on the end of an action to track the metrics
   * @param {*} [error_]
   */
  async onEnd(error_) {
    const { payload, startTime } = this.analytics
    const duration = getDuration(startTime)
    const status = error_ === undefined ? 'success' : 'error'

    debug(`${this.name()}:onEnd`)(`Status: ${status}`)
    debug(`${this.name()}:onEnd`)(`Duration: ${duration}ms`)

    await track('command', {
      ...payload,
      command: this.name(),
      duration,
      status,
    })

    if (error_ !== undefined) {
      error(error_ instanceof Error ? error_ : format(error_), { exit: false })
      exit(1)
    }
  }

  async authenticate(tokenFromFlag) {
    const [token] = await getToken(tokenFromFlag)
    if (token) {
      return token
    }
    return this.expensivelyAuthenticate()
  }

  async expensivelyAuthenticate() {
    const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'
    log(`Logging into your Netlify account...`)

    // Create ticket for auth
    // @ts-ignore Types from api are wrong and they don't recognize `createTicket`
    const ticket = await this.netlify.api.createTicket({
      clientId: CLIENT_ID,
    })

    // Open browser for authentication
    const authLink = `${webUI}/authorize?response_type=ticket&ticket=${ticket.id}`

    log(`Opening ${authLink}`)
    await openBrowser({ url: authLink })

    const accessToken = await pollForToken({
      api: this.netlify.api,
      ticket,
    })

    // @ts-ignore Types from api are wrong and they don't recognize `getCurrentUser`
    const { email, full_name: name, id: userId } = await this.netlify.api.getCurrentUser()

    const userData = merge(this.netlify.globalConfig.get(`users.${userId}`), {
      id: userId,
      name,
      email,
      auth: {
        token: accessToken,
        github: {
          user: undefined,
          token: undefined,
        },
      },
    })
    // Set current userId
    this.netlify.globalConfig.set('userId', userId)
    // Set user data
    this.netlify.globalConfig.set(`users.${userId}`, userData)

    await identify({
      name,
      email,
      userId,
    })
    await track('user_login', {
      email,
    })

    // Log success
    log()
    log(`${chalk.greenBright('You are now logged into your Netlify account!')}`)
    log()
    log(`Run ${chalk.cyanBright('netlify status')} for account details`)
    log()
    log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
    log()
    return accessToken
  }

  setAnalyticsPayload(payload) {
    this.analytics = { ...this.analytics, payload }
  }

  /**
   * Initializes the options and parses the configuration needs to be called on start of a command function
   * @param {BaseCommand} actionCommand The command of the action that is run (`this.` gets the parent command)
   */
  async init(actionCommand) {
    debug(`${actionCommand.name()}:init`)('start')
    const options = actionCommand.opts()
    const cwd = options.cwd || process.cwd()
    // Get site id & build state
    const state = new StateConfig(cwd)

    const [token] = await getToken(options.auth)

    const apiUrlOpts = {
      userAgent: USER_AGENT,
    }

    if (process.env.NETLIFY_API_URL) {
      const apiUrl = new URL(process.env.NETLIFY_API_URL)
      apiUrlOpts.scheme = apiUrl.protocol.slice(0, -1)
      apiUrlOpts.host = apiUrl.host
      apiUrlOpts.pathPrefix =
        process.env.NETLIFY_API_URL === `${apiUrl.protocol}//${apiUrl.host}` ? '/api/v1' : apiUrl.pathname
    }

    const cachedConfig = await actionCommand.getConfig({ cwd, state, token, ...apiUrlOpts })
    const { buildDir, config, configPath, repositoryRoot, siteInfo } = cachedConfig
    const normalizedConfig = normalizeConfig(config)

    const agent = await getAgent({
      httpProxy: options.httpProxy,
      certificateFile: options.httpProxyCertificateFilename,
    })
    const apiOpts = { ...apiUrlOpts, agent }
    const globalConfig = await getGlobalConfig()
    const { NetlifyAPI } = await jsClient

    actionCommand.netlify = {
      // api methods
      api: new NetlifyAPI(token || '', apiOpts),
      repositoryRoot,
      // current site context
      site: {
        root: buildDir,
        configPath,
        get id() {
          return state.get('siteId')
        },
        set id(id) {
          state.set('siteId', id)
        },
      },
      // Site information retrieved using the API
      siteInfo,
      // Configuration from netlify.[toml/yml]
      config: normalizedConfig,
      // Used to avoid calling @netlify/config again
      cachedConfig,
      // global cli config
      globalConfig,
      // state of current site dir
      state,
    }
    debug(`${this.name()}:init`)('end')
  }

  /**
   * Find and resolve the Netlify configuration
   * @param {*} config
   * @returns {ReturnType<import('@netlify/config/src/main')>}
   */
  async getConfig(config) {
    const options = this.opts()
    const { cwd, host, offline = options.offline, pathPrefix, scheme, state, token } = config

    try {
      return await resolveConfig({
        config: options.config,
        cwd,
        context: options.context || this.name(),
        debug: this.opts().debug,
        siteId: options.siteId || (typeof options.site === 'string' && options.site) || state.get('siteId'),
        token,
        mode: 'cli',
        host,
        pathPrefix,
        scheme,
        offline,
      })
    } catch (error_) {
      const isUserError = error_.customErrorInfo !== undefined && error_.customErrorInfo.type === 'resolveConfig'

      // If we're failing due to an error thrown by us, it might be because the token we're using is invalid.
      // To account for that, we try to retrieve the config again, this time without a token, to avoid making
      // any API calls.
      //
      // @todo Replace this with a mechanism for calling `resolveConfig` with more granularity (i.e. having
      // the option to say that we don't need API data.)
      if (isUserError && !offline && token) {
        return this.getConfig({ cwd, offline: true, state, token })
      }

      const message = isUserError ? error_.message : error_.stack
      console.error(message)
      exit(1)
    }
  }
}

module.exports = { BaseCommand }
