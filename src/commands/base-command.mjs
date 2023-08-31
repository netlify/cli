// @ts-check
import { existsSync } from 'fs'
import { join, relative, resolve } from 'path'
import process from 'process'
import { format } from 'util'

import { DefaultLogger, Project } from '@netlify/build-info'
// eslint-disable-next-line import/extensions, n/no-missing-import
import { NodeFS, NoopLogger } from '@netlify/build-info/node'
import { resolveConfig } from '@netlify/config'
import { Command, Option } from 'commander'
import debug from 'debug'
import { findUp } from 'find-up'
import inquirer from 'inquirer'
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt'
import merge from 'lodash/merge.js'
import { NetlifyAPI } from 'netlify'

import { getAgent } from '../lib/http-agent.mjs'
import {
  NETLIFY_CYAN,
  USER_AGENT,
  chalk,
  error,
  exit,
  getToken,
  log,
  normalizeConfig,
  padLeft,
  pollForToken,
  sortOptions,
  warn,
} from '../utils/command-helpers.mjs'
import getGlobalConfig from '../utils/get-global-config.mjs'
import { getSiteByName } from '../utils/get-site.mjs'
import openBrowser from '../utils/open-browser.mjs'
import StateConfig from '../utils/state-config.mjs'
import { identify, reportError, track } from '../utils/telemetry/index.mjs'

// load the autocomplete plugin
inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)
/** Netlify CLI client id. Lives in bot@netlify.com */
// TODO: setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

const NANO_SECS_TO_MSECS = 1e6
/** The fallback width for the help terminal */
const FALLBACK_HELP_CMD_WIDTH = 80

const HELP_$ = NETLIFY_CYAN('$')
/** indent on commands or description on the help page */
const HELP_INDENT_WIDTH = 2
/** separator width between term and description */
const HELP_SEPARATOR_WIDTH = 5

/**
 * A list of commands where we don't have to perform the workspace selection at.
 * Those commands work with the system or are not writing any config files that need to be
 * workspace aware.
 */
const COMMANDS_WITHOUT_WORKSPACE_OPTIONS = new Set(['api', 'recipes', 'completion', 'status', 'switch', 'login', 'lm'])

/**
 * Formats a help list correctly with the correct indent
 * @param {string[]} textArray
 * @returns
 */
const formatHelpList = (textArray) => textArray.join('\n').replace(/^/gm, ' '.repeat(HELP_INDENT_WIDTH))

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
 * Retrieves a workspace package based of the filter flag that is provided.
 * If the filter flag does not match a workspace package or is not defined then it will prompt with an autocomplete to select a package
 * @param {Project} project
 * @param {string=} filter
 * @returns {Promise<string>}
 */
async function selectWorkspace(project, filter) {
  const selected = project.workspace?.packages.find((pkg) => {
    if (
      project.relativeBaseDirectory &&
      project.relativeBaseDirectory.length !== 0 &&
      pkg.path.startsWith(project.relativeBaseDirectory)
    ) {
      return true
    }
    return (pkg.name && pkg.name === filter) || pkg.path === filter
  })

  if (!selected) {
    log()
    log(chalk.cyan(`We've detected multiple sites inside your repository`))

    const { result } = await inquirer.prompt({
      name: 'result',
      type: 'autocomplete',
      message: 'Select the site you want to work with',
      source: (/** @type {string} */ _, input = '') =>
        (project.workspace?.packages || [])
          .filter((pkg) => pkg.path.includes(input))
          .map((pkg) => ({
            name: `${pkg.name ? `${chalk.bold(pkg.name)}  ` : ''}${pkg.path}  ${chalk.dim(
              `--filter ${pkg.name || pkg.path}`,
            )}`,
            value: pkg.path,
          })),
    })

    return result
  }
  return selected.path
}

/** Base command class that provides tracking and config initialization */
export default class BaseCommand extends Command {
  /**
   * The netlify object inside each command with the state
   * @type {import('./types.js').NetlifyOptions}
   */
  netlify

  /** @type {{ startTime: bigint, payload?: any}} */
  analytics = { startTime: process.hrtime.bigint() }

  /** @type {Project} */
  project

  /**
   * The working directory that is used for reading the `netlify.toml` file and storing the state.
   * In a monorepo context this must not be the process working directory and can be an absolute path to the
   * Package/Site that should be worked in.
   */
  // here we actually want to disable the lint rule as its value is set
  // eslint-disable-next-line workspace/no-process-cwd
  workingDir = process.cwd()

  /**
   * The workspace root if inside a mono repository.
   * Must not be the repository root!
   * @type {string|undefined}
   */
  jsWorkspaceRoot
  /**
   * The current workspace package we should execute the commands in
   * @type {string|undefined}
   */
  workspacePackage

  /**
   * IMPORTANT this function will be called for each command!
   * Don't do anything expensive in there.
   * @param {string} name The command name
   * @returns
   */
  createCommand(name) {
    const base = new BaseCommand(name)
      // If  --silent or --json flag passed disable logger
      .addOption(new Option('--json', 'Output return values as JSON').hideHelp(true))
      .addOption(new Option('--silent', 'Silence CLI output').hideHelp(true))
      .addOption(new Option('--cwd <cwd>').hideHelp(true))
      .addOption(new Option('-o, --offline').hideHelp(true))
      .addOption(new Option('--auth <token>', 'Netlify auth token').hideHelp(true))
      .addOption(
        new Option('--httpProxy [address]', 'Old, prefer --http-proxy. Proxy server address to route requests through.')
          .default(process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
          .hideHelp(true),
      )
      .addOption(
        new Option(
          '--httpProxyCertificateFilename [file]',
          'Old, prefer --http-proxy-certificate-filename. Certificate file to use when connecting using a proxy server.',
        )
          .default(process.env.NETLIFY_PROXY_CERTIFICATE_FILENAME)
          .hideHelp(true),
      )
      .addOption(
        new Option(
          '--http-proxy-certificate-filename [file]',
          'Certificate file to use when connecting using a proxy server',
        )
          .default(process.env.NETLIFY_PROXY_CERTIFICATE_FILENAME)
          .hideHelp(true),
      )
      .addOption(
        new Option('--httpProxy [address]', 'Proxy server address to route requests through.')
          .default(process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
          .hideHelp(true),
      )
      .option('--debug', 'Print debugging information')

    // only add the `--filter` option to commands that are workspace aware
    if (!COMMANDS_WITHOUT_WORKSPACE_OPTIONS.has(name)) {
      base.option('--filter <app>', 'For monorepos, specify the name of the application to run the command in')
    }

    return base.hook('preAction', async (_parentCommand, actionCommand) => {
      if (actionCommand.opts()?.debug) {
        process.env.DEBUG = '*'
      }
      debug(`${name}:preAction`)('start')
      this.analytics = { startTime: process.hrtime.bigint() }
      // @ts-ignore cannot type actionCommand as BaseCommand
      await this.init(actionCommand)
      debug(`${name}:preAction`)('end')
    })
  }

  /** @private */
  noBaseOptions = false

  /** don't show help options on command overview (mostly used on top commands like `addons` where options only apply on children) */
  noHelpOptions() {
    this.noBaseOptions = true
    return this
  }

  /** @type {string[]} The examples list for the command (used inside doc generation and help page) */
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
          : `${HELP_$} ${command.parent?.name()} ${command.name()} ${command.usage()}`

      return padLeft(term, HELP_INDENT_WIDTH)
    }

    /**
     * @param {BaseCommand} command
     */
    const getCommands = (command) => {
      const parentCommand = this.name() === 'netlify' ? command : command.parent
      return (
        parentCommand?.commands.filter((cmd) => {
          if (cmd._hidden) return false
          // the root command
          if (this.name() === 'netlify') {
            // don't include subcommands on the main page
            return !cmd.name().includes(':')
          }
          return cmd.name().startsWith(`${command.name()}:`)
        }) || []
      )
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
          const pad = termWidth + HELP_SEPARATOR_WIDTH
          const fullText = `${bang}${term.padEnd(pad - (isCommand ? 2 : 0))}${chalk.grey(description)}`
          return helper.wrap(fullText, helpWidth - HELP_INDENT_WIDTH, pad)
        }

        return `${bang}${term}`
      }

      /** @type {string[]} */
      let output = []

      // Description
      const [topDescription, ...commandDescription] = (helper.commandDescription(command) || '').split('\n')
      if (topDescription.length !== 0) {
        output = [...output, topDescription, '']
      }

      // on the parent help command the version should be displayed
      if (this.name() === 'netlify') {
        output = [...output, chalk.bold('VERSION'), formatHelpList([formatItem(USER_AGENT)]), '']
      }

      // Usage
      output = [...output, chalk.bold('USAGE'), helper.commandUsage(command), '']

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
          .sort(sortOptions)
          .map((option) => formatItem(helper.optionTerm(option), helper.optionDescription(option)))
        if (optionList.length !== 0) {
          output = [...output, chalk.bold('OPTIONS'), formatHelpList(optionList), '']
        }
      }

      // Description
      if (commandDescription.length !== 0) {
        output = [...output, chalk.bold('DESCRIPTION'), formatHelpList(commandDescription), '']
      }

      // Aliases

      if (command._aliases.length !== 0) {
        const aliases = command._aliases.map((alias) => formatItem(`${parentCommand.name()} ${alias}`, null, true))
        output = [...output, chalk.bold('ALIASES'), formatHelpList(aliases), '']
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
        formatItem(cmd.name(), helper.subcommandDescription(cmd).split('\n')[0], true),
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

  /**
   *
   * @param {string|undefined} tokenFromFlag
   * @returns
   */
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

  /**
   * Adds some data to the analytics payload
   * @param {Record<string, unknown>} payload
   */
  setAnalyticsPayload(payload) {
    const newPayload = { ...this.analytics.payload, ...payload }
    this.analytics = { ...this.analytics, payload: newPayload }
  }

  /**
   * Initializes the options and parses the configuration needs to be called on start of a command function
   * @param {BaseCommand} actionCommand The command of the action that is run (`this.` gets the parent command)
   * @private
   */
  async init(actionCommand) {
    debug(`${actionCommand.name()}:init`)('start')
    const flags = actionCommand.opts()
    // here we actually want to use the process.cwd as we are setting the workingDir
    // eslint-disable-next-line workspace/no-process-cwd
    this.workingDir = flags.cwd ? resolve(flags.cwd) : process.cwd()

    // ==================================================
    // Create a Project and run the Heuristics to detect
    // if we are running inside a monorepo or not.
    // ==================================================

    // retrieve the repository root
    const rootDir = await getRepositoryRoot()
    // Get framework, add to analytics payload for every command, if a framework is set
    const fs = new NodeFS()
    // disable logging inside the project and FS if not in debug mode
    fs.logger = actionCommand.opts()?.debug ? new DefaultLogger('debug') : new NoopLogger()
    this.project = new Project(fs, this.workingDir, rootDir)
      .setEnvironment(process.env)
      .setNodeVersion(process.version)
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .setReportFn((err, reportConfig) => {
        reportError(err, {
          severity: reportConfig?.severity || 'error',
          metadata: reportConfig?.metadata,
        })
      })
    const frameworks = await this.project.detectFrameworks()
    /** @type { string|undefined} */
    let packageConfig = flags.config ? resolve(flags.config) : undefined
    // check if we have detected multiple projects inside which one we have to perform our operations.
    // only ask to select one if on the workspace root
    if (
      !COMMANDS_WITHOUT_WORKSPACE_OPTIONS.has(actionCommand.name()) &&
      this.project.workspace?.packages.length &&
      this.project.workspace.isRoot
    ) {
      this.workspacePackage = await selectWorkspace(this.project, actionCommand.opts().filter)
      this.workingDir = join(this.project.jsWorkspaceRoot, this.workspacePackage)
    }

    this.jsWorkspaceRoot = this.project.jsWorkspaceRoot
    // detect if a toml exists in this package.
    const tomlFile = join(this.workingDir, 'netlify.toml')
    if (!packageConfig && existsSync(tomlFile)) {
      packageConfig = tomlFile
    }

    // ==================================================
    // Retrieve Site id and build state from the state.json
    // ==================================================
    const state = new StateConfig(this.workingDir)
    const [token] = await getToken(flags.auth)

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

    // ==================================================
    // Start retrieving the configuration through the
    // configuration file and the API
    // ==================================================
    const cachedConfig = await actionCommand.getConfig({
      cwd: flags.cwd ? this.workingDir : this.jsWorkspaceRoot || this.workingDir,
      repositoryRoot: rootDir,
      packagePath: this.workspacePackage,
      // The config flag needs to be resolved from the actual process working directory
      configFilePath: packageConfig,
      state,
      token,
      ...apiUrlOpts,
    })
    const { buildDir, config, configPath, repositoryRoot, siteInfo } = cachedConfig
    const normalizedConfig = normalizeConfig(config)
    const agent = await getAgent({
      httpProxy: flags.httpProxy,
      certificateFile: flags.httpProxyCertificateFilename,
    })
    const apiOpts = { ...apiUrlOpts, agent }
    const api = new NetlifyAPI(token || '', apiOpts)

    // If a user passes a site name as an option instead of a site ID to options.site, the siteInfo object
    // will only have the property siteInfo.id. Checking for one of the other properties ensures that we can do
    // a re-call of the api.getSite() that is done in @netlify/config so we have the proper site object in all
    // commands.
    // options.site as a site name (and not just site id) was introduced for the deploy command, so users could
    // deploy by name along with by id
    let siteData = siteInfo
    if (!siteData.url && flags.site) {
      siteData = await getSiteByName(api, flags.site)
    }

    const globalConfig = await getGlobalConfig()

    // ==================================================
    // Perform analytics reporting
    // ==================================================
    const frameworkIDs = frameworks?.map((framework) => framework.id)
    if (frameworkIDs?.length !== 0) {
      this.setAnalyticsPayload({ frameworks: frameworkIDs })
    }
    this.setAnalyticsPayload({
      monorepo: Boolean(this.project.workspace),
      packageManager: this.project.packageManager?.name,
      buildSystem: this.project.buildSystems.map(({ id }) => id),
    })

    // set the project and the netlify api object on the command,
    // to be accessible inside each command.
    actionCommand.project = this.project
    actionCommand.workingDir = this.workingDir
    actionCommand.workspacePackage = this.workspacePackage
    actionCommand.jsWorkspaceRoot = this.jsWorkspaceRoot

    // Either an existing configuration file from `@netlify/config` or a file path
    // that should be used for creating it.
    const configFilePath = configPath || join(this.workingDir, 'netlify.toml')

    actionCommand.netlify = {
      // api methods
      api,
      apiOpts,
      // The absolute repository root (detected through @netlify/config)
      repositoryRoot,
      configFilePath,
      relConfigFilePath: relative(repositoryRoot, configFilePath),
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
      // Site information retrieved using the API (api.getSite())
      siteInfo: siteData,
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
   * @param {object} config
   * @param {string} config.cwd
   * @param {string|null=} config.token
   * @param {*} config.state
   * @param {boolean=} config.offline
   * @param {string=} config.configFilePath An optional path to the netlify configuration file e.g. netlify.toml
   * @param {string=} config.packagePath
   * @param {string=} config.repositoryRoot
   * @param {string=} config.host
   * @param {string=} config.pathPrefix
   * @param {string=} config.scheme
   * @returns {ReturnType<typeof resolveConfig>}
   */
  async getConfig(config) {
    // the flags that are passed to the command like `--debug` or `--offline`
    const flags = this.opts()

    try {
      return await resolveConfig({
        config: config.configFilePath,
        packagePath: config.packagePath,
        repositoryRoot: config.repositoryRoot,
        cwd: config.cwd,
        context: flags.context || process.env.CONTEXT || this.getDefaultContext(),
        debug: flags.debug,
        siteId: flags.siteId || (typeof flags.site === 'string' && flags.site) || config.state.get('siteId'),
        token: config.token,
        mode: 'cli',
        host: config.host,
        pathPrefix: config.pathPrefix,
        scheme: config.scheme,
        offline: config.offline ?? flags.offline,
        siteFeatureFlagPrefix: 'cli',
      })
    } catch (error_) {
      const isUserError = error_.customErrorInfo !== undefined && error_.customErrorInfo.type === 'resolveConfig'

      // If we're failing due to an error thrown by us, it might be because the token we're using is invalid.
      // To account for that, we try to retrieve the config again, this time without a token, to avoid making
      // any API calls.
      //
      // @todo Replace this with a mechanism for calling `resolveConfig` with more granularity (i.e. having
      // the option to say that we don't need API data.)
      if (isUserError && !config.offline && config.token) {
        if (flags.debug) {
          error(error_, { exit: false })
          warn('Failed to resolve config, falling back to offline resolution')
        }
        // recursive call with trying to resolve offline
        return this.getConfig({ ...config, offline: true })
      }

      const message = isUserError ? error_.message : error_.stack
      error(message, { exit: true })
    }
  }

  /**
   * Returns the context that should be used in case one hasn't been explicitly
   * set. The default context is `dev` most of the time, but some commands may
   * wish to override that.
   *
   * @returns {'production' | 'dev'}
   */
  getDefaultContext() {
    return this.name() === 'serve' ? 'production' : 'dev'
  }
}

/**
 * Retrieves the repository root through a git command.
 * Returns undefined if not a git project.
 * @param {string} [cwd] The optional current working directory
 * @returns {Promise<string|undefined>}
 */
async function getRepositoryRoot(cwd) {
  const res = await findUp('.git', { cwd, type: 'directory' })
  if (res) {
    return join(res, '..')
  }
}
