const process = require('process')
const { URL } = require('url')
const { format, inspect } = require('util')

const resolveConfig = require('@netlify/config')
const { Command, flags: flagsLib } = require('@oclif/command')
const oclifParser = require('@oclif/parser')
const merge = require('lodash/merge')
const argv = require('minimist')(process.argv.slice(2))
const API = require('netlify')

const { getAgent } = require('../lib/http-agent')
const { startSpinner, clearSpinner } = require('../lib/spinner')

const chalkInstance = require('./chalk')
const getGlobalConfig = require('./get-global-config')
const openBrowser = require('./open-browser')
const StateConfig = require('./state-config')
const { track, identify } = require('./telemetry')

const { NETLIFY_AUTH_TOKEN, NETLIFY_API_URL } = process.env

// Netlify CLI client id. Lives in bot@netlify.com
// Todo setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

// 'api' command uses JSON output by default
// 'functions:invoke' need to return the data from the function as is
const isDefaultJson = () => argv._[0] === 'functions:invoke' || (argv._[0] === 'api' && argv.list !== true)

const getToken = async (tokenFromFlag) => {
  // 1. First honor command flag --auth
  if (tokenFromFlag) {
    return [tokenFromFlag, 'flag']
  }
  // 2. then Check ENV var
  if (NETLIFY_AUTH_TOKEN && NETLIFY_AUTH_TOKEN !== 'null') {
    return [NETLIFY_AUTH_TOKEN, 'env']
  }
  // 3. If no env var use global user setting
  const globalConfig = await getGlobalConfig()
  const userId = globalConfig.get('userId')
  const tokenFromConfig = globalConfig.get(`users.${userId}.auth.token`)
  if (tokenFromConfig) {
    return [tokenFromConfig, 'config']
  }
  return [null, 'not found']
}

// 5 Minutes
const TOKEN_TIMEOUT = 3e5

const pollForToken = async ({ api, ticket, exitWithError, chalk }) => {
  const spinner = startSpinner({ text: 'Waiting for authorization...' })
  try {
    const accessToken = await api.getAccessToken(ticket, { timeout: TOKEN_TIMEOUT })
    if (!accessToken) {
      exitWithError('Could not retrieve access token')
    }
    return accessToken
  } catch (error) {
    if (error.name === 'TimeoutError') {
      exitWithError(
        `Timed out waiting for authorization. If you do not have a ${chalk.bold.greenBright(
          'Netlify',
        )} account, please create one at ${chalk.magenta(
          'https://app.netlify.com/signup',
        )}, then run ${chalk.cyanBright('netlify login')} again.`,
      )
    } else {
      exitWithError(error)
    }
  } finally {
    clearSpinner({ spinner })
  }
}

class BaseCommand extends Command {
  // Initialize context
  async init() {
    const cwd = argv.cwd || process.cwd()
    // Grab netlify API token
    const authViaFlag = getAuthArg(argv)

    const [token] = await this.getConfigToken(authViaFlag)

    // Get site id & build state
    const state = new StateConfig(cwd)

    const apiUrlOpts = {}

    if (NETLIFY_API_URL) {
      const apiUrl = new URL(NETLIFY_API_URL)
      apiUrlOpts.scheme = apiUrl.protocol.slice(0, -1)
      apiUrlOpts.host = apiUrl.host
      apiUrlOpts.pathPrefix = NETLIFY_API_URL === `${apiUrl.protocol}//${apiUrl.host}` ? '/api/v1' : apiUrl.pathname
    }

    const cachedConfig = await this.getConfig({ cwd, state, token, ...apiUrlOpts })
    const { configPath, config, buildDir, repositoryRoot, siteInfo } = cachedConfig

    const { flags } = this.parse(BaseCommand)
    const agent = await getAgent({
      log: this.log,
      exit: this.exit,
      httpProxy: flags.httpProxy,
      certificateFile: flags.httpProxyCertificateFilename,
    })
    const apiOpts = { ...apiUrlOpts, agent }
    const globalConfig = await getGlobalConfig()

    this.netlify = {
      // api methods
      api: new API(token || '', apiOpts),
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
      config,
      // Used to avoid calling @netlify/config again
      cachedConfig,
      // global cli config
      globalConfig,
      // state of current site dir
      state,
    }
  }

  // Find and resolve the Netlify configuration
  async getConfig({ cwd, host, offline = argv.offline, pathPrefix, scheme, state, token }) {
    try {
      return await resolveConfig({
        config: argv.config,
        cwd,
        context: argv.context || this.commandContext,
        debug: argv.debug,
        siteId: argv.siteId || (typeof argv.site === 'string' && argv.site) || state.get('siteId'),
        token,
        mode: 'cli',
        host,
        pathPrefix,
        scheme,
        offline,
      })
    } catch (error) {
      const isUserError = error.type === 'userError'

      // If we're failing due to an error thrown by us, it might be because the token we're using is invalid.
      // To account for that, we try to retrieve the config again, this time without a token, to avoid making
      // any API calls.
      //
      // @todo Replace this with a mechanism for calling `resolveConfig` with more granularity (i.e. having
      // the option to say that we don't need API data.)
      if (isUserError && !offline && token) {
        return this.getConfig({ cwd, offline: true, state, token })
      }

      const message = isUserError ? error.message : error.stack
      console.error(message)
      this.exit(1)
    }
  }

  async isLoggedIn() {
    try {
      await this.netlify.api.getCurrentUser()
      return true
    } catch (_) {
      return false
    }
  }

  logJson(message = '') {
    if (argv.json || isDefaultJson()) {
      process.stdout.write(JSON.stringify(message, null, 2))
    }
  }

  log(message = '', ...args) {
    /* If  --silent or --json flag passed disable logger */
    if (argv.silent || argv.json || isDefaultJson()) {
      return
    }
    message = typeof message === 'string' ? message : inspect(message)
    process.stdout.write(`${format(message, ...args)}\n`)
  }

  /* Modified flag parser to support global --auth, --json, & --silent flags */
  parse(opts, args = this.argv) {
    /* Set flags object for commands without flags */
    if (!opts.flags) {
      opts.flags = {}
    }
    /* enrich parse with global flags */
    const globalFlags = {}
    if (!opts.flags.silent) {
      globalFlags.silent = {
        parse: (value) => value,
        description: 'Silence CLI output',
        allowNo: false,
        type: 'boolean',
      }
    }
    if (!opts.flags.json) {
      globalFlags.json = {
        parse: (value) => value,
        description: 'Output return values as JSON',
        allowNo: false,
        type: 'boolean',
      }
    }
    if (!opts.flags.auth) {
      globalFlags.auth = {
        parse: (value) => value,
        description: 'Netlify auth token',
        input: [],
        multiple: false,
        type: 'option',
      }
    }

    // enrich with flags here
    opts.flags = { ...opts.flags, ...globalFlags }

    return oclifParser.parse(args, {
      context: this,
      ...opts,
    })
  }

  get chalk() {
    // If --json flag disable chalk colors
    return chalkInstance(argv.json)
  }

  /**
   * Get user netlify API token
   * @param  {string} - [tokenFromFlag] - value passed in by CLI flag
   * @return {Promise<[string, string]>} - Promise containing tokenValue & location of resolved Netlify API token
   */
  getConfigToken(tokenFromFlag) {
    return getToken(tokenFromFlag)
  }

  async authenticate(tokenFromFlag) {
    const [token] = await this.getConfigToken(tokenFromFlag)
    if (token) {
      return token
    }
    return this.expensivelyAuthenticate()
  }

  async expensivelyAuthenticate() {
    const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'
    this.log(`Logging into your Netlify account...`)

    // Create ticket for auth
    const ticket = await this.netlify.api.createTicket({
      clientId: CLIENT_ID,
    })

    // Open browser for authentication
    const authLink = `${webUI}/authorize?response_type=ticket&ticket=${ticket.id}`

    this.log(`Opening ${authLink}`)
    await openBrowser({ url: authLink, log: this.log })

    const accessToken = await pollForToken({
      api: this.netlify.api,
      ticket,
      exitWithError: this.error,
      chalk: this.chalk,
    })

    const user = await this.netlify.api.getCurrentUser()
    const userID = user.id

    const userData = merge(this.netlify.globalConfig.get(`users.${userID}`), {
      id: userID,
      name: user.full_name,
      email: user.email,
      auth: {
        token: accessToken,
        github: {
          user: undefined,
          token: undefined,
        },
      },
    })
    // Set current userId
    this.netlify.globalConfig.set('userId', userID)
    // Set user data
    this.netlify.globalConfig.set(`users.${userID}`, userData)

    const { email } = user
    await identify({
      name: user.full_name,
      email,
    }).then(() =>
      track('user_login', {
        email,
      }),
    )

    // Log success
    this.log()
    this.log(`${this.chalk.greenBright('You are now logged into your Netlify account!')}`)
    this.log()
    this.log(`Run ${this.chalk.cyanBright('netlify status')} for account details`)
    this.log()
    this.log(`To see all available commands run: ${this.chalk.cyanBright('netlify help')}`)
    this.log()
    return accessToken
  }
}

const getAuthArg = function (cliArgs) {
  // If deploy command. Support shorthand 'a' flag
  if (cliArgs && cliArgs._ && cliArgs._[0] === 'deploy') {
    return cliArgs.auth || cliArgs.a
  }
  return cliArgs.auth
}

BaseCommand.strict = false
BaseCommand.flags = {
  debug: flagsLib.boolean({
    description: 'Print debugging information',
  }),
  httpProxy: flagsLib.string({
    description: 'Proxy server address to route requests through.',
    default: process.env.HTTP_PROXY || process.env.HTTPS_PROXY,
  }),
  httpProxyCertificateFilename: flagsLib.string({
    description: 'Certificate file to use when connecting using a proxy server',
    default: process.env.NETLIFY_PROXY_CERTIFICATE_FILENAME,
  }),
}

BaseCommand.getToken = getToken
module.exports = BaseCommand
