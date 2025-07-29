import { existsSync } from 'fs'
import { join, relative, resolve } from 'path'
import process from 'process'
import { format } from 'util'

import { NetlifyAPI } from '@netlify/api'
import { DefaultLogger, Project } from '@netlify/build-info'
import { NodeFS, NoopLogger } from '@netlify/build-info/node'
import { resolveConfig } from '@netlify/config'
import { getGlobalConfigStore, LocalState } from '@netlify/dev-utils'
import { isCI } from 'ci-info'
import { Command, Help, Option, type OptionValues } from 'commander'
import debug from 'debug'
import { findUp } from 'find-up'
import inquirer from 'inquirer'
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt'
import merge from 'lodash/merge.js'
import pick from 'lodash/pick.js'

import { getAgent } from '../lib/http-agent.js'
import {
  NETLIFY_CYAN,
  USER_AGENT,
  chalk,
  logAndThrowError,
  exit,
  getToken,
  log,
  version,
  normalizeConfig,
  padLeft,
  pollForToken,
  sortOptions,
  warn,
  logError,
} from '../utils/command-helpers.js'
import type { FeatureFlags } from '../utils/feature-flags.js'
import { getFrameworksAPIPaths } from '../utils/frameworks-api.js'
import { getSiteByName } from '../utils/get-site.js'
import openBrowser from '../utils/open-browser.js'
import { identify, reportError, track } from '../utils/telemetry/index.js'
import type { NetlifyOptions } from './types.js'
import type { CachedConfig } from '../lib/build.js'

type Analytics = {
  startTime: bigint
  payload?: Record<string, unknown>
}

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
const COMMANDS_WITHOUT_WORKSPACE_OPTIONS = new Set(['api', 'recipes', 'completion', 'status', 'switch', 'login'])

/**
 * A list of commands where we need to fetch featureflags for config resolution
 */
const COMMANDS_WITH_FEATURE_FLAGS = new Set(['build', 'dev', 'deploy'])

/**
 * Names of options whose values should be scrubbed
 */
const SCRUBBED_OPTIONS = new Set(['auth'])

const getScrubbedOptions = (command: BaseCommand): Record<string, { source: OptionValues['source']; value: unknown }> =>
  Object.entries(command.optsWithGlobals()).reduce(
    (acc: Record<string, { source: OptionValues['source']; value: unknown }>, [key, value]) => ({
      ...acc,
      [key]: {
        source: command.getOptionValueSourceWithGlobals(key),
        value: SCRUBBED_OPTIONS.has(key) ? '********' : value,
      },
    }),
    {},
  )

/** Formats a help list correctly with the correct indent */
const formatHelpList = (textArray: string[]) => textArray.join('\n').replace(/^/gm, ' '.repeat(HELP_INDENT_WIDTH))

/** Get the duration between a start time and the current time */
const getDuration = (startTime: bigint) => {
  const durationNs = process.hrtime.bigint() - startTime
  return Math.round(Number(durationNs / BigInt(NANO_SECS_TO_MSECS)))
}

/**
 * Retrieves a workspace package based of the filter flag that is provided.
 * If the filter flag does not match a workspace package or is not defined then it will prompt with an autocomplete to select a package
 */
async function selectWorkspace(project: Project, filter?: string): Promise<string> {
  // don't show prompt for workspace selection if there is only one package
  if (project.workspace?.packages && project.workspace.packages.length === 1) {
    return project.workspace.packages[0].path
  }

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
    log(chalk.cyan(`We've detected multiple projects inside your repository`))

    if (isCI) {
      throw new Error(
        `Projects detected: ${(project.workspace?.packages || [])
          .map((pkg) => pkg.name || pkg.path)
          .join(
            ', ',
          )}. Configure the project you want to work with and try again. Refer to https://ntl.fyi/configure-site for more information.`,
      )
    }

    const { result } = await inquirer.prompt({
      name: 'result',
      // @ts-expect-error(serhalp) -- I think this is because `inquirer-autocomplete-prompt` extends known
      // `type`s but TS doesn't know about it
      type: 'autocomplete',
      message: 'Select the project you want to work with',
      source: (_unused: unknown, input = '') =>
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

async function getRepositoryRoot(cwd?: string): Promise<string | undefined> {
  const res = await findUp('.git', { cwd, type: 'directory' })
  if (res) {
    return join(res, '..')
  }
}

export type BaseOptionValues = {
  auth?: string
  cwd?: string
  debug?: boolean
  filter?: string
  httpProxy?: string
  silent?: string
}

/** Base command class that provides tracking and config initialization */
export default class BaseCommand extends Command {
  /** The netlify object inside each command with the state */
  netlify!: NetlifyOptions
  // TODO(serhalp) We set `startTime` here and then overwrite it in a `preAction` hook. This is
  // just asking for latent bugs. Remove this one?
  analytics: Analytics = { startTime: process.hrtime.bigint() }
  project!: Project

  /**
   * The working directory that is used for reading the `netlify.toml` file and storing the state.
   * In a monorepo context this must not be the process working directory and can be an absolute path to the
   * Package/Site that should be worked in.
   */
  // here we actually want to disable the lint rule as its value is set
  // eslint-disable-next-line no-restricted-properties
  workingDir = process.cwd()

  /**
   * The workspace root if inside a mono repository.
   * Must not be the repository root!
   */
  jsWorkspaceRoot?: string
  /** The current workspace package we should execute the commands in  */
  workspacePackage?: string

  featureFlags: FeatureFlags = {}
  siteId?: string
  accountId?: string

  /**
   * IMPORTANT this function will be called for each command!
   * Don't do anything expensive in there.
   */
  createCommand(name: string): BaseCommand {
    const base = new BaseCommand(name)
      // .addOption(new Option('--force', 'Force command to run. Bypasses prompts for certain destructive commands.'))
      .addOption(new Option('--silent', 'Silence CLI output').hideHelp(true))
      .addOption(new Option('--cwd <cwd>').hideHelp(true))
      .addOption(
        new Option('--auth <token>', 'Netlify auth token - can be used to run this command without logging in'),
      )
      .addOption(
        new Option('--http-proxy [address]', 'Proxy server address to route requests through.')
          .default(process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
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
      this.analytics.startTime = process.hrtime.bigint()
      await this.init(actionCommand as BaseCommand)
      debug(`${name}:preAction`)('end')
    })
  }

  #noBaseOptions = false
  /** don't show help options on command overview (mostly used on top commands like `addons` where options only apply on children) */
  noHelpOptions() {
    this.#noBaseOptions = true
    return this
  }

  /** The examples list for the command (used inside doc generation and help page) */
  examples: string[] = []
  /** Set examples for the command  */
  addExamples(examples: string[]) {
    this.examples = examples
    return this
  }

  /** Overrides the help output of commander with custom styling */
  createHelp(): Help {
    const help = super.createHelp()

    help.commandUsage = (command) => {
      const term =
        this.name() === 'netlify'
          ? `${HELP_$} ${command.name()} [COMMAND]`
          : `${HELP_$} ${command.parent?.name()} ${command.name()} ${command.usage()}`

      return padLeft(term, HELP_INDENT_WIDTH)
    }

    const getCommands = (command: BaseCommand) => {
      const parentCommand = this.name() === 'netlify' ? command : command.parent
      return (
        parentCommand?.commands
          .filter((cmd) => {
            if ((cmd as any)._hidden) return false
            // the root command
            if (this.name() === 'netlify') {
              // don't include subcommands on the main page
              return !cmd.name().includes(':')
            }
            return cmd.name().startsWith(`${command.name()}:`)
          })
          .sort((a, b) => a.name().localeCompare(b.name())) || []
      )
    }

    help.longestSubcommandTermLength = (command: BaseCommand): number =>
      getCommands(command).reduce((max, cmd) => Math.max(max, cmd.name().length), 0)

    /** override the longestOptionTermLength to react on hide options flag */
    help.longestOptionTermLength = (command: BaseCommand, helper: Help): number =>
      // @ts-expect-error TS(2551) FIXME: Property 'noBaseOptions' does not exist on type 'C... Remove this comment to see the full error message
      (command.noBaseOptions === false &&
        helper.visibleOptions(command).reduce((max, option) => Math.max(max, helper.optionTerm(option).length), 0)) ||
      0

    help.formatHelp = (command: BaseCommand, helper: Help): string => {
      const parentCommand = this.name() === 'netlify' ? command : command.parent
      const termWidth = helper.padWidth(command, helper)
      const helpWidth = helper.helpWidth || FALLBACK_HELP_CMD_WIDTH
      // formats a term correctly
      const formatItem = (term: string, description?: string, isCommand = false): string => {
        const bang = isCommand ? `${HELP_$} ` : ''

        if (description) {
          const pad = termWidth + HELP_SEPARATOR_WIDTH
          const fullText = `${bang}${term.padEnd(pad - (isCommand ? 2 : 0))}${chalk.grey(description)}`
          return helper.wrap(fullText, helpWidth - HELP_INDENT_WIDTH, pad)
        }

        return `${bang}${term}`
      }

      let output: string[] = []

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

      if (command.#noBaseOptions === false) {
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

      // @ts-expect-error TS(2551) FIXME: Property '_aliases' does not exist on type 'Comman... Remove this comment to see the full error message
      if (command._aliases.length !== 0) {
        // @ts-expect-error TS(2551) FIXME: Property '_aliases' does not exist on type 'Comman... Remove this comment to see the full error message
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

  /** Will be called on the end of an action to track the metrics */
  async onEnd(error_?: unknown) {
    const { payload = {}, startTime } = this.analytics
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
    } catch (err) {
      debug(`${this.name()}:onEnd`)(
        `Command: ${command}. Telemetry tracking failed: ${err instanceof Error ? err.message : err?.toString()}`,
      )
    }

    if (error_ !== undefined) {
      logError(error_ instanceof Error ? error_ : format(error_))
      exit(1)
    }
  }

  async authenticate(tokenFromFlag?: string) {
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
    log(chalk.greenBright('You are now logged into your Netlify account!'))
    log()
    log(`Run ${chalk.cyanBright('netlify status')} for account details`)
    log()
    log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
    log()
    return accessToken
  }

  /** Adds some data to the analytics payload */
  setAnalyticsPayload(payload: Record<string, unknown>) {
    this.analytics = {
      ...this.analytics,
      payload: { ...this.analytics.payload, ...payload },
    }
  }

  /**
   * Initializes the options and parses the configuration needs to be called on start of a command function
   */
  private async init(actionCommand: BaseCommand) {
    debug(`${actionCommand.name()}:init`)('start')
    const flags = actionCommand.opts()

    // here we actually want to use the process.cwd as we are setting the workingDir
    // eslint-disable-next-line no-restricted-properties
    const processCwd = process.cwd()

    if (flags.cwd) {
      const resolvedCwd = resolve(flags.cwd)
      this.workingDir = resolvedCwd

      // if cwd matches process.cwd, act like cwd wasn't provided
      if (resolvedCwd === processCwd) {
        delete flags.cwd
        this.workingDir = processCwd
      }
    }

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
      .setReportFn((err, reportConfig) => {
        reportError(err, {
          severity: reportConfig?.severity || 'error',
          metadata: reportConfig?.metadata,
        })
      })
    const frameworks = await this.project.detectFrameworks()
    let packageConfig: string | undefined = flags.config ? resolve(flags.config) : undefined
    // check if we have detected multiple projects inside which one we have to perform our operations.
    // only ask to select one if on the workspace root and no --cwd was provided
    if (
      !flags.cwd &&
      !COMMANDS_WITHOUT_WORKSPACE_OPTIONS.has(actionCommand.name()) &&
      this.project.workspace?.packages.length &&
      this.project.workspace.isRoot
    ) {
      this.workspacePackage = await selectWorkspace(this.project, actionCommand.opts().filter)
      this.workingDir = join(this.project.jsWorkspaceRoot, this.workspacePackage)
    }

    if (this.project.workspace?.packages.length && !this.project.workspace.isRoot) {
      // set the package path even though we are not in the workspace root
      // as the build command will set the process working directory to the workspace root
      this.workspacePackage = this.project.relativeBaseDirectory
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
    const state = new LocalState(this.workingDir)
    const [token] = await getToken(flags.auth)

    const apiUrlOpts: {
      userAgent: string
      scheme?: string
      host?: string
      pathPrefix?: string
    } = {
      userAgent: USER_AGENT,
    }

    if (process.env.NETLIFY_API_URL) {
      const apiUrl = new URL(process.env.NETLIFY_API_URL)
      apiUrlOpts.scheme = apiUrl.protocol.slice(0, -1)
      apiUrlOpts.host = apiUrl.host
      apiUrlOpts.pathPrefix =
        process.env.NETLIFY_API_URL === `${apiUrl.protocol}//${apiUrl.host}` ? '/api/v1' : apiUrl.pathname
    }

    const agent = await getAgent({
      httpProxy: flags.httpProxy,
      certificateFile: flags.httpProxyCertificateFilename,
    })
    const apiOpts = { ...apiUrlOpts, agent }
    const api = new NetlifyAPI(token ?? '', apiOpts)

    actionCommand.siteId = flags.siteId || (typeof flags.site === 'string' && flags.site) || state.get('siteId')

    const needsFeatureFlagsToResolveConfig = COMMANDS_WITH_FEATURE_FLAGS.has(actionCommand.name())
    if (api.accessToken && !flags.offline && needsFeatureFlagsToResolveConfig && actionCommand.siteId) {
      try {
        // FIXME(serhalp): Remove `any` and fix errors. API types exist now.
        const site = await (api as any).getSite({ siteId: actionCommand.siteId, feature_flags: 'cli' })
        actionCommand.featureFlags = site.feature_flags
        actionCommand.accountId = site.account_id
      } catch {
        // if the site is not found, that could mean that the user passed a site name, not an ID
      }
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
      token,
      ...apiUrlOpts,
    })
    const { accounts = [], buildDir, config, configPath, repositoryRoot, siteInfo } = cachedConfig
    let { env } = cachedConfig
    if (flags.offlineEnv) {
      env = {}
    }
    env.NETLIFY_CLI_VERSION = { sources: ['internal'], value: version }
    const normalizedConfig = normalizeConfig(config)

    // If a user passes a site name as an option instead of a site ID to options.site, the siteInfo object
    // will only have the property siteInfo.id. Checking for one of the other properties ensures that we can do
    // a re-call of the api.getSite() that is done in @netlify/config so we have the proper site object in all
    // commands.
    // options.site as a site name (and not just site id) was introduced for the deploy command, so users could
    // deploy by name along with by id
    let siteData = siteInfo
    if (!siteData.url && flags.site) {
      const result = await getSiteByName(api, flags.site)
      if (result == null) {
        return logAndThrowError(`Project with name "${flags.site}" not found`)
      }
      siteData = result
    }

    const globalConfig = await getGlobalConfigStore()

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
      opts: getScrubbedOptions(actionCommand),
      args: actionCommand.args,
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
      accounts,
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
      cachedConfig: {
        ...cachedConfig,
        env,
      },
      // global cli config
      // TODO(serhalp): Rename to `globalConfigStore`
      globalConfig,
      // state of current site dir
      // TODO(serhalp): Rename to `cliState`
      state,
      frameworksAPIPaths: getFrameworksAPIPaths(buildDir, this.workspacePackage),
    }
    debug(`${this.name()}:init`)('end')
  }

  /** Find and resolve the Netlify configuration */
  async getConfig(opts: {
    cwd: string
    token?: string | null
    offline?: boolean
    /** An optional path to the netlify configuration file e.g. netlify.toml */
    configFilePath?: string
    packagePath?: string
    repositoryRoot?: string
    host?: string
    pathPrefix?: string
    scheme?: string
  }): Promise<CachedConfig> {
    const { configFilePath, cwd, host, offline, packagePath, pathPrefix, repositoryRoot, scheme, token } = opts
    // the flags that are passed to the command like `--debug` or `--offline`
    const flags = this.opts()

    try {
      // FIXME(serhalp): Type this in `netlify/build`! This is blocking a ton of proper types across the CLI.
      return await resolveConfig({
        accountId: this.accountId,
        config: configFilePath,
        packagePath: packagePath,
        repositoryRoot: repositoryRoot,
        cwd: cwd,
        context: flags.context || process.env.CONTEXT || this.getDefaultContext(),
        debug: flags.debug,
        siteId: this.siteId,
        token: token,
        mode: 'cli',
        host: host,
        pathPrefix: pathPrefix,
        scheme: scheme,
        offline: offline ?? flags.offline,
        siteFeatureFlagPrefix: 'cli',
        featureFlags: this.featureFlags,
      })
    } catch (error_) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      const isUserError = error_.customErrorInfo !== undefined && error_.customErrorInfo.type === 'resolveConfig'

      // If we're failing due to an error thrown by us, it might be because the token we're using is invalid.
      // To account for that, we try to retrieve the config again, this time without a token, to avoid making
      // any API calls.
      //
      // @todo Replace this with a mechanism for calling `resolveConfig` with more granularity (i.e. having
      // the option to say that we don't need API data.)
      if (isUserError && !offline && token) {
        if (flags.debug) {
          logError(error_)
          warn('Failed to resolve config, falling back to offline resolution')
        }
        // recursive call with trying to resolve offline
        return this.getConfig({ ...opts, offline: true })
      }

      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      const message = isUserError ? error_.message : error_.stack
      return logAndThrowError(message)
    }
  }

  /**
   * get a path inside the `.netlify` project folder resolving with the workspace package
   */
  getPathInProject(...paths: string[]): string {
    return join(this.workspacePackage || '', '.netlify', ...paths)
  }

  /**
   * Returns the context that should be used in case one hasn't been explicitly
   * set. The default context is `dev` most of the time, but some commands may
   * wish to override that.
   */
  getDefaultContext(): 'production' | 'dev' {
    return this.name() === 'serve' ? 'production' : 'dev'
  }

  /**
   * Retrieve feature flags for this site
   */
  getFeatureFlag<T extends null | boolean | string>(flagName: string): T {
    // @ts-expect-error(serhalp) -- FIXME(serhalp): This probably isn't what we intend.
    // We should return `false` feature flags as `false` and not `null`. Carefully fix.
    return this.netlify.siteInfo.feature_flags?.[flagName] || null
  }
}

export const getBaseOptionValues = (options: OptionValues): BaseOptionValues =>
  pick(options, ['auth', 'cwd', 'debug', 'filter', 'httpProxy', 'silent'])
