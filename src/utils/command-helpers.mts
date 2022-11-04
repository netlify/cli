// @ts-check
// @ts-expect-error TS(6200): Definitions of the following identifiers conflict ... Remove this comment to see the full error message
const { once } = require('events')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'os'.
const os = require('os')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')
const { format, inspect } = require('util')

// eslint-disable-next-line no-restricted-modules
const { Instance: ChalkInstance } = require('chalk')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chokidar'.
const chokidar = require('chokidar')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'decache'.
const decache = require('decache')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'WSL'.
const WSL = require('is-wsl')
const debounce = require('lodash/debounce')
const { default: omit } = require('omit.js')
const terminalLink = require('terminal-link')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'name'.
const { name, version } = require('../../package.json')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'clearSpinn... Remove this comment to see the full error message
const { clearSpinner, startSpinner } = require('../lib/spinner.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getGlobalC... Remove this comment to see the full error message
const getGlobalConfig = require('./get-global-config.cjs')

/** The parsed process argv without the binary only arguments and flags */
const argv = process.argv.slice(2)
/**
 * Chalk instance for CLI that can be initialized with no colors mode
 * needed for json outputs where we don't want to have colors
 * @param  {boolean} noColors - disable chalk colors
 * @return {object} - default or custom chalk instance
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const safeChalk = function (noColors: $TSFixMe) {
  if (noColors) {
    const colorlessChalk = new ChalkInstance({ level: 0 })
    return colorlessChalk
  }
  return new ChalkInstance()
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const chalk = safeChalk(argv.includes('--json'))

/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const padLeft = (str: $TSFixMe, count: $TSFixMe, filler = ' ') => str.padStart(str.length + count, filler)

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'platform'.
const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'USER_AGENT... Remove this comment to see the full error message
const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

/** A list of base command flags that needs to be sorted down on documentation and on help pages */
const BASE_FLAGS = new Set(['--debug', '--httpProxy', '--httpProxyCertificateFilename'])

// eslint-disable-next-line no-magic-numbers
const NETLIFY_CYAN = chalk.rgb(40, 180, 170)

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const NETLIFYDEV = `${chalk.greenBright('◈')} ${NETLIFY_CYAN('Netlify Dev')} ${chalk.greenBright('◈')}`
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const NETLIFYDEVLOG = `${chalk.greenBright('◈')}`
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const NETLIFYDEVWARN = `${chalk.yellowBright('◈')}`
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const NETLIFYDEVERR = `${chalk.redBright('◈')}`

const BANG = process.platform === 'win32' ? '»' : '›'

/**
 * Sorts two options so that the base flags are at the bottom of the list
 * @param {import('commander').Option} optionA
 * @param {import('commander').Option} optionB
 * @returns {number}
 * @example
 * options.sort(sortOptions)
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'sortOption... Remove this comment to see the full error message
const sortOptions = (optionA: $TSFixMe, optionB: $TSFixMe) => {
  // base flags should be always at the bottom
  if (BASE_FLAGS.has(optionA.long) || BASE_FLAGS.has(optionB.long)) {
    return -1
  }
  return optionA.long.localeCompare(optionB.long)
}

// Poll Token timeout 5 Minutes
const TOKEN_TIMEOUT = 3e5

/**
 *
 * @param {object} config
 * @param {import('netlify').NetlifyAPI} config.api
 * @param {object} config.ticket
 * @returns
 */
const pollForToken = async ({
  api,
  ticket
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const spinner = startSpinner({ text: 'Waiting for authorization...' })
  try {
    const accessToken = await api.getAccessToken(ticket, { timeout: TOKEN_TIMEOUT })
    if (!accessToken) {
      error('Could not retrieve access token')
    }
    return accessToken
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).name === 'TimeoutError') {
      error(
        `Timed out waiting for authorization. If you do not have a ${chalk.bold.greenBright(
          'Netlify',
        )} account, please create one at ${chalk.magenta(
          'https://app.netlify.com/signup',
        )}, then run ${chalk.cyanBright('netlify login')} again.`,
      )
    } else {
      error(error_)
    }
  } finally {
    clearSpinner({ spinner })
  }
}

/**
 * Get a netlify token
 * @param {string} [tokenFromOptions] optional token from the provided --auth options
 * @returns {Promise<[null|string, 'flag' | 'env' |'config' |'not found']>}
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getToken'.
const getToken = async (tokenFromOptions: $TSFixMe) => {
  // 1. First honor command flag --auth
  if (tokenFromOptions) {
    return [tokenFromOptions, 'flag']
  }
  // 2. then Check ENV var
  const { NETLIFY_AUTH_TOKEN } = process.env
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

// 'api' command uses JSON output by default
// 'functions:invoke' need to return the data from the function as is
const isDefaultJson = () => argv[0] === 'functions:invoke' || (argv[0] === 'api' && !argv.includes('--list'))

/**
 * logs a json message
 * @param {string|object} message
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'logJson'.
const logJson = (message = '') => {
  if (argv.includes('--json') || isDefaultJson()) {
    process.stdout.write(JSON.stringify(message, null, 2))
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
const log = (message = '', ...args: $TSFixMe[]) => {
  // If  --silent or --json flag passed disable logger
  if (argv.includes('--json') || argv.includes('--silent') || isDefaultJson()) {
    return
  }
  message = typeof message === 'string' ? message : inspect(message)
  process.stdout.write(`${format(message, ...args)}\n`)
}

/**
 * logs a warning message
 * @param {string} message
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
const warn = (message = '') => {
  const bang = chalk.yellow(BANG)
  log(` ${bang}   Warning: ${message}`)
}

/**
 * throws an error or log it
 * @param {string|Error} message
 * @param {object} [options]
 * @param {boolean} [options.exit]
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const error = (message = '', options = {}) => {
  // @ts-expect-error TS(2358): The left-hand side of an 'instanceof' expression m... Remove this comment to see the full error message
  const err = message instanceof Error ? message : new Error(message)
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  if ((options as $TSFixMe).exit === false) {
    const bang = chalk.red(BANG)
    if (process.env.DEBUG) {
      // @ts-expect-error TS(2532): Object is possibly 'undefined'.
      process.stderr.write(` ${bang}   Warning: ${err.stack.split('\n').join(`\n ${bang}   `)}\n`)
    } else {
      process.stderr.write(` ${bang}   ${chalk.red(`${err.name}:`)} ${err.message}\n`)
    }
  } else {
    throw err
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'exit'.
const exit = (code = 0) => {
  process.exit(code)
}

// When `build.publish` is not set by the user, the CLI behavior differs in
// several ways. It detects it by checking if `build.publish` is `undefined`.
// However, `@netlify/config` adds a default value to `build.publish`.
// This removes it.
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const normalizeConfig = (config: $TSFixMe) => config.build.publishOrigin === 'default'
  ? { ...config, build: omit(config.build, ['publish', 'publishOrigin']) }
  : config

const DEBOUNCE_WAIT = 100

/**
 * Adds a file watcher to a path or set of paths and debounces the events.
 *
 * @param {string | string[]} target
 * @param {Object} opts
 * @param {number} [opts.depth]
 * @param {() => any} [opts.onAdd]
 * @param {() => any} [opts.onChange]
 * @param {() => any} [opts.onUnlink]
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'watchDebou... Remove this comment to see the full error message
const watchDebounced = async (target: $TSFixMe, {
  depth,
  onAdd = () => {},
  onChange = () => {},
  onUnlink = () => {}
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const watcher = chokidar.watch(target, { depth, ignored: /node_modules/, ignoreInitial: true })

  await once(watcher, 'ready')

  const debouncedOnChange = debounce(onChange, DEBOUNCE_WAIT)
  const debouncedOnUnlink = debounce(onUnlink, DEBOUNCE_WAIT)
  const debouncedOnAdd = debounce(onAdd, DEBOUNCE_WAIT)

  watcher
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .on('change', (path: $TSFixMe) => {
      decache(path)
      debouncedOnChange(path)
    })
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .on('unlink', (path: $TSFixMe) => {
      decache(path)
      debouncedOnUnlink(path)
    })
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .on('add', (path: $TSFixMe) => {
      decache(path)
      debouncedOnAdd(path)
    })

  return watcher
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getTermina... Remove this comment to see the full error message
const getTerminalLink = (text: $TSFixMe, url: $TSFixMe) => terminalLink(text, url, { fallback: () => `${text} ${url}` })

module.exports = {
  BANG,
  chalk,
  error,
  exit,
  getTerminalLink,
  getToken,
  log,
  logJson,
  NETLIFY_CYAN,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  normalizeConfig,
  padLeft,
  pollForToken,
  sortOptions,
  USER_AGENT,
  warn,
  watchDebounced,
}
