// @ts-check
import process from 'process'
import { format } from 'util'

// @ts-expect-error TS(7016): Could not find a declaration file for module '@net... Remove this comment to see the full error message
import { resolveConfig } from '@netlify/config'
import { Command, Option } from 'commander'
// @ts-expect-error TS(7016): Could not find a declaration file for module 'debu... Remove this comment to see the full error message
import debug from 'debug'
// @ts-expect-error TS(7016): Could not find a declaration file for module 'loda... Remove this comment to see the full error message
import merge from 'lodash/merge.js'
import { NetlifyAPI } from 'netlify'

import { getAgent } from '../lib/http-agent.mjs'
// TODO: use named imports again once the imported file is esm
import utils from '../utils/index.mjs'

const {
  NETLIFY_CYAN,
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
  padLeft,
  pollForToken,
  sortOptions,
  track,
  warn,
} = utils

// Netlify CLI client id. Lives in bot@netlify.com
// TODO: setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

const NANO_SECS_TO_MSECS = 1e6
// The fallback width for the help terminal
const FALLBACK_HELP_CMD_WIDTH = 80

const HELP_$ = NETLIFY_CYAN('$')
// indent on commands or description on the help page
const HELP_INDENT_WIDTH = 2
// separator width between term and description
const HELP_SEPARATOR_WIDTH = 5

/**
 * Formats a help list correctly with the correct indent
 * @param {string[]} textArray
 * @returns
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const formatHelpList = (textArray: $TSFixMe) => textArray.join('\n').replace(/^/gm, ' '.repeat(HELP_INDENT_WIDTH))

/**
 * Get the duration between a start time and the current time
 * @param {bigint} startTime
 * @returns
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getDuration = function (startTime: $TSFixMe) {
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
export default class BaseCommand extends Command {
  // @ts-expect-error TS(2612): Property 'args' will overwrite the base property i... Remove this comment to see the full error message
  args: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  name: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  opts: $TSFixMe;
  /** @type {NetlifyOptions} */
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  netlify: $TSFixMe

  /** @type {{ startTime: bigint, payload?: any}} */
  analytics = { startTime: process.hrtime.bigint() }

  /**
   * IMPORTANT this function will be called for each command!
   * Don't do anything expensive in there.
   * @param {string} name The command name
   * @returns
   */
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  createCommand(name: $TSFixMe) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    return (new BaseCommand(name) as $TSFixMe).addOption(new Option('--json', 'Output return values as JSON').hideHelp(true))
    .addOption(new Option('--silent', 'Silence CLI output').hideHelp(true))
    .addOption(new Option('--cwd <cwd>').hideHelp(true))
    .addOption(new Option('-o, --offline').hideHelp(true))
    .addOption(new Option('--auth <token>', 'Netlify auth token').hideHelp(true))
    .option('--httpProxyCertificateFilename [file]', 'Certificate file to use when connecting using a proxy server', process.env.NETLIFY_PROXY_CERTIFICATE_FILENAME)
    .option('--httpProxy [address]', 'Proxy server address to route requests through.', process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
    .option('--debug', 'Print debugging information')
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .hook('preAction', async (_parentCommand: $TSFixMe, actionCommand: $TSFixMe) => {
    debug(`${name}:preAction`)('start');
    this.analytics = { startTime: process.hrtime.bigint() };
    await this.init(actionCommand);
    debug(`${name}:preAction`)('end');
});
  }

  /** @private */
  noBaseOptions = false

  /** don't show help options on command overview (mostly used on top commands like `addons` where options only apply on children) */
  noHelpOptions() {
    this.noBaseOptions = true
    return this
  }

  /** The examples list for the command (used inside doc generation and help page) */
  examples = []

  /**
   * Set examples for the command
   * @param {string[]} examples
   */
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  addExamples(examples: $TSFixMe) {
    this.examples = examples
    return this
  }

  /**
   * Overrides the help output of commander with custom styling
   * @returns {import('commander').Help}
   */
  createHelp() {
    const help = super.createHelp()

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    help.commandUsage = (command: $TSFixMe) => {
      const term =
        this.name() === 'netlify'
          ? `${HELP_$} ${command.name()} [COMMAND]`
          :                                             `${HELP_$} ${command.parent.name()} ${command.name()} ${command.usage()}`

      return padLeft(term, HELP_INDENT_WIDTH)
    }

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    const getCommands = (command: $TSFixMe) => {
      const parentCommand = this.name() === 'netlify' ? command : command.parent
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      return parentCommand.commands.filter((cmd: $TSFixMe) => {
        // eslint-disable-next-line no-underscore-dangle
        if (cmd._hidden) return false
        // the root command
        if (this.name() === 'netlify') {
          // don't include subcommands on the main page
          return !cmd.name().includes(':')
        }
        return cmd.name().startsWith(`${command.name()}:`)
      });
    }

    /**
     * override the longestSubcommandTermLength
     * @param {BaseCommand} command
     * @returns {number}
     */
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    help.longestSubcommandTermLength = (command: $TSFixMe) => getCommands(command).reduce((max: $TSFixMe, cmd: $TSFixMe) => Math.max(max, cmd.name().length), 0)

    /**
     * override the longestOptionTermLength to react on hide options flag
     * @param {BaseCommand} command
     * @param {import('commander').Help} helper
     * @returns {number}
     */
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    help.longestOptionTermLength = (command: $TSFixMe, helper: $TSFixMe) =>
      (command.noBaseOptions === false &&
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        helper.visibleOptions(command).reduce((max: $TSFixMe, option: $TSFixMe) => Math.max(max, helper.optionTerm(option).length), 0)) ||
      0

    /**
 * override the format help function to style it correctly
 * @param {BaseCommand} command
 * @param {import('commander').Help} helper
 * @returns {string}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
help.formatHelp = (command: $TSFixMe, helper: $TSFixMe) => {
    const parentCommand = this.name() === 'netlify' ? command : command.parent;
    const termWidth = helper.padWidth(command, helper);
    const helpWidth = helper.helpWidth || FALLBACK_HELP_CMD_WIDTH;
    /**
     * formats a term correctly
     * @param {string} term
     * @param {string} [description]
     * @param {boolean} [isCommand]
     * @returns {string}
     */
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    const formatItem = (term: $TSFixMe, description: $TSFixMe, isCommand = false) => {
        const bang = isCommand ? `${HELP_$} ` : '';
        if (description) {
            const pad = termWidth + HELP_SEPARATOR_WIDTH;
            const fullText = `${bang}${term.padEnd(pad - (isCommand ? 2 : 0))}${chalk.grey(description)}`;
            return helper.wrap(fullText, helpWidth - HELP_INDENT_WIDTH, pad);
        }
        return `${bang}${term}`;
    };
    /** @type {string[]} */
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    let output: $TSFixMe = [];
    // Description
    const [topDescription, ...commandDescription] = (helper.commandDescription(command) || '').split('\n');
    if (topDescription.length !== 0) {
        output = [...output, topDescription, ''];
    }
    // on the parent help command the version should be displayed
    if (this.name() === 'netlify') {
        // @ts-expect-error TS(2554): Expected 2-3 arguments, but got 1.
        output = [...output, chalk.bold('VERSION'), formatHelpList([formatItem(USER_AGENT)]), ''];
    }
    // Usage
    output = [...output, chalk.bold('USAGE'), helper.commandUsage(command), ''];
    // Arguments
    const argumentList = helper
        .visibleArguments(command)
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        .map((argument: $TSFixMe) => formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument)));
    if (argumentList.length !== 0) {
        output = [...output, chalk.bold('ARGUMENTS'), formatHelpList(argumentList), ''];
    }
    if (command.noBaseOptions === false) {
        // Options
        const optionList = helper
            .visibleOptions(command)
            .sort(sortOptions)
            // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
            .map((option: $TSFixMe) => formatItem(helper.optionTerm(option), helper.optionDescription(option)));
        if (optionList.length !== 0) {
            output = [...output, chalk.bold('OPTIONS'), formatHelpList(optionList), ''];
        }
    }
    // Description
    if (commandDescription.length !== 0) {
        output = [...output, chalk.bold('DESCRIPTION'), formatHelpList(commandDescription), ''];
    }
    // Aliases
    // eslint-disable-next-line no-underscore-dangle
    if (command._aliases.length !== 0) {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        // eslint-disable-next-line no-underscore-dangle
        const aliases = command._aliases.map((alias: $TSFixMe) => formatItem(`${parentCommand.name()} ${alias}`, null, true));
        output = [...output, chalk.bold('ALIASES'), formatHelpList(aliases), ''];
    }
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((command as $TSFixMe).examples.length !== 0) {
        output = [
            ...output,
            chalk.bold('EXAMPLES'),
            // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
            formatHelpList((command as $TSFixMe).examples.map((example: $TSFixMe) => `${HELP_$} ${example}`)),
            '',
        ];
    }
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    const commandList = getCommands(command).map((cmd: $TSFixMe) => formatItem(cmd.name(), helper.subcommandDescription(cmd).split('\n')[0], true));
    if (commandList.length !== 0) {
        output = [...output, chalk.bold('COMMANDS'), formatHelpList(commandList), ''];
    }
    return [...output, ''].join('\n');
};
    return help
  }

  /**
   * Will be called on the end of an action to track the metrics
   * @param {*} [error_]
   */
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  async onEnd(error_: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'payload' does not exist on type '{ start... Remove this comment to see the full error message
    const { payload, startTime } = this.analytics
    const duration = getDuration(startTime)
    const status = error_ === undefined ? 'success' : 'error'

    const command = Array.isArray(this.args) ? this.args[0] : this.name()

    debug(`${this.name()}:onEnd`)(`Command: ${command}. Status: ${status}. Duration: ${duration}ms`)

    try {
      await track('command', {
        ...payload,
        command,
        duration,
        status,
      })
    } catch {}

    if (error_ !== undefined) {
      error(error_ instanceof Error ? error_ : format(error_), { exit: false })
      exit(1)
    }
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  async authenticate(tokenFromFlag: $TSFixMe) {
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

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  setAnalyticsPayload(payload: $TSFixMe) {
    // @ts-expect-error TS(2322): Type '{ payload: $TSFixMe; startTime: bigint; }' i... Remove this comment to see the full error message
    this.analytics = { ...this.analytics, payload }
  }

  /**
   * Initializes the options and parses the configuration needs to be called on start of a command function
   * @param {BaseCommand} actionCommand The command of the action that is run (`this.` gets the parent command)
   * @private
   */
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  async init(actionCommand: $TSFixMe) {
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
      // @ts-expect-error TS(7022): 'apiUrl' implicitly has type 'any' because it does... Remove this comment to see the full error message
      const apiUrl = new URL(process.env.NETLIFY_API_URL)
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      (apiUrlOpts as $TSFixMe).scheme = apiUrl.protocol.slice(0, -1);
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      (apiUrlOpts as $TSFixMe).host = apiUrl.host;
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      (apiUrlOpts as $TSFixMe).pathPrefix =
    process.env.NETLIFY_API_URL === `${apiUrl.protocol}//${apiUrl.host}` ? '/api/v1' : apiUrl.pathname;
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

    actionCommand.netlify = {
      // api methods
      api: new NetlifyAPI(token || '', apiOpts),
      apiOpts,
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
  // @ts-expect-error TS(7023): 'getConfig' implicitly has return type 'any' becau... Remove this comment to see the full error message
  async getConfig(config: $TSFixMe) {
    const options = this.opts()
    const { cwd, host, offline = options.offline, pathPrefix, scheme, state, token } = config

    try {
      return await resolveConfig({
        config: options.config,
        cwd,
        context:
          options.context ||
          process.env.CONTEXT ||
          // Dev commands have a default context of `dev`, otherwise we let netlify/config handle default behavior
          (['dev', 'dev:exec'].includes(this.name()) ? 'dev' : undefined),
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
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      const isUserError = (error_ as $TSFixMe).customErrorInfo !== undefined && (error_ as $TSFixMe).customErrorInfo.type === 'resolveConfig';

      // If we're failing due to an error thrown by us, it might be because the token we're using is invalid.
      // To account for that, we try to retrieve the config again, this time without a token, to avoid making
      // any API calls.
      //
      // @todo Replace this with a mechanism for calling `resolveConfig` with more granularity (i.e. having
      // the option to say that we don't need API data.)
      if (isUserError && !offline && token) {
        if (this.opts().debug) {
          error(error_, { exit: false })
          warn('Failed to resolve config, falling back to offline resolution')
        }
        return this.getConfig({ cwd, offline: true, state, token })
      }

      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      const message = isUserError ? (error_ as $TSFixMe).message : (error_ as $TSFixMe).stack;
      console.error(message)
      exit(1)
    }
  }
}
