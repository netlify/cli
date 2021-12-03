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
  HELP_$,
  HELP_INDENT_WIDTH,
  HELP_SEPERATOR_WIDTH,
  StateConfig,
  USER_AGENT,
  chalk,
  error,
  exit,
  formatHelpList,
  getGlobalConfig,
  getToken,
  identify,
  log,
  normalizeConfig,
  openBrowser,
  padLeft,
  pollForToken,
  track,
} = require('../utils')

// Netlify CLI client id. Lives in bot@netlify.com
// TODO: setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

const NANO_SECS_TO_MSECS = 1e6
// The fallback width for the help terminal
const FALLBACK_HELP_CMD_WIDTH = 80
// AN option description that should be hidden in the help page
const OPTION_HIDDEN_DESCRIPTION = 'hidden:true'

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
        .option('--json', OPTION_HIDDEN_DESCRIPTION)
        .option('--cwd <cwd>', OPTION_HIDDEN_DESCRIPTION)
        .option('-o, --offline', OPTION_HIDDEN_DESCRIPTION)

        // Allow hidden flags like
        // --json,
        // --silent,
        // --offline, -o
        // --cwd <cwd> Pass a current working directory.

        // this disables the suggestions
        // .allowUnknownOption(true)

        // 'Print debugging information'
        .option('--debug', OPTION_HIDDEN_DESCRIPTION)
        // 'Proxy server address to route requests through'
        .option('--httpProxy', OPTION_HIDDEN_DESCRIPTION, process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
        // 'Certificate file to use when connecting using a proxy server',
        .option(
          '--httpProxyCertificateFilename',
          OPTION_HIDDEN_DESCRIPTION,
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

  /** @private */
  noBaseOptions = false

  /** don't show help options on command overview (mostly used on top commands like `addons` where options only apply on children) */
  noHelpOptions() {
    this.noBaseOptions = true
    return this
  }

  /** @private */
  examples = []

  /**
   * Set examples for the command
   * @param {string[]} examples
   */
  addExamples(examples) {
    this.examples = examples
    return this
  }


  /**
   * Overrides the help output of commander with custom styling
   * @returns {import('commander').Help}
   */
  createHelp() {
    const help = super.createHelp()

    help.commandUsage = (command) => {
      const term =
        this.name() === 'netlify'
          ? `${HELP_$} ${command.name()} [COMMAND]`
          : `${HELP_$} ${command.parent.name()} ${command.name()} ${command.usage()}`

      return padLeft(term, HELP_INDENT_WIDTH)
    }

    const getCommands = (command) => {
      const parentCommand = this.name() === 'netlify' ? command : command.parent
      return parentCommand.commands.filter((cmd) => {
        // eslint-disable-next-line no-underscore-dangle
        if (cmd._hidden) return false
        // the root command
        if (this.name() === 'netlify') {
          // don't include subcommands on the main page
          return !cmd.name().includes(':')
        }
        return cmd.name().startsWith(`${command.name()}:`)
      })
    }

    /**
     * override the longestSubcommandTermLength
     * @param {BaseCommand} command
     * @returns {number}
     */
    help.longestSubcommandTermLength = (command) =>
      getCommands(command).reduce((max, cmd) => Math.max(max, cmd.name().length), 0)

    /**
     * override the longestOptionTermLength to react on hide options flag
     * @param {BaseCommand} command
     * @param {import('commander').Help} helper
     * @returns {number}
     */
    help.longestOptionTermLength = (command, helper) =>
      (command.noBaseOptions === false &&
        helper.visibleOptions(command).reduce((max, option) => Math.max(max, helper.optionTerm(option).length), 0)) ||
      0

    /**
     * override the format help function to style it correctly
     * @param {BaseCommand} command
     * @param {import('commander').Help} helper
     * @returns {string}
     */
    help.formatHelp = (command, helper) => {
      const parentCommand = this.name() === 'netlify' ? command : command.parent
      const termWidth = helper.padWidth(command, helper)
      const helpWidth = helper.helpWidth || FALLBACK_HELP_CMD_WIDTH
      /**
       * formats a term correctly
       * @param {string} term
       * @param {string} [description]
       * @param {boolean} [isCommand]
       * @returns {string}
       */
      const formatItem = (term, description, isCommand = false) => {
        const bang = isCommand ? `${HELP_$} ` : ''

        if (description) {
          const pad = termWidth + HELP_SEPERATOR_WIDTH - (isCommand ? 2 : 0)
          const fullText = `${bang}${term.padEnd(pad)}${chalk.grey(description)}`
          return helper.wrap(fullText, helpWidth - HELP_INDENT_WIDTH, pad)
        }

        return `${bang}${term}`
      }

      /** @type {string[]} */
      let output = []

      // Description
      const commandDescription = helper.commandDescription(command)
      if (commandDescription.length !== 0) {
        output = [...output, commandDescription, '']
      }

      // on the parent help command the version should be displayed
      if (this.name() === 'netlify') {
        output = [...output, chalk.bold('VERSION'), formatHelpList([formatItem(USER_AGENT)]), '']
      }

      // Usage
      output = [...output, chalk.bold('USAGE'), helper.commandUsage(command), '']

      // Aliases
      // eslint-disable-next-line no-underscore-dangle
      if (command._aliases.length !== 0) {
        // eslint-disable-next-line no-underscore-dangle
        const aliases = command._aliases.map((alias) => formatItem(`${parentCommand.name()} ${alias}`, null, true))
        output = [...output, chalk.bold('ALIASES'), formatHelpList(aliases), '']
      }

      // Arguments
      const argumentList = helper
        .visibleArguments(command)
        .map((argument) => formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument)))
      if (argumentList.length !== 0) {
        output = [...output, chalk.bold('ARGUMENTS'), formatHelpList(argumentList), '']
      }

      if (command.noBaseOptions === false) {
        // Options
        const optionList = helper
          .visibleOptions(command)
          .filter((option) => option.description !== OPTION_HIDDEN_DESCRIPTION)
          .map((option) => formatItem(helper.optionTerm(option), helper.optionDescription(option)))
        if (optionList.length !== 0) {
          output = [...output, chalk.bold('OPTIONS'), formatHelpList(optionList), '']
        }
      }

      if (command.examples.length !== 0) {
        output = [
          ...output,
          chalk.bold('EXAMPLES'),
          formatHelpList(command.examples.map((example) => `${HELP_$} ${example}`)),
          '',
        ]
      }

      const commandList = getCommands(command).map((cmd) =>
        formatItem(cmd.name(), helper.subcommandDescription(cmd), true),
      )
      if (commandList.length !== 0) {
        output = [...output, chalk.bold('COMMANDS'), formatHelpList(commandList), '']
      }

      return [...output, ''].join('\n')
    }
    return help
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
   * @private
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

module.exports = { BaseCommand, OPTION_HIDDEN_DESCRIPTION }
