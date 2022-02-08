// @ts-check
const os = require('os')
const process = require('process')
const { format, inspect } = require('util')

const { Instance: ChalkInstance } = require('chalk')
const WSL = require('is-wsl')
const { default: omit } = require('omit.js')

const { name, version } = require('../../package.json')
const { clearSpinner, startSpinner } = require('../lib/spinner')

const getGlobalConfig = require('./get-global-config')

/** The parsed process argv without the binary only arguments and flags */
const argv = process.argv.slice(2)
/**
 * Chalk instance for CLI that can be initialized with no colors mode
 * needed for json outputs where we don't want to have colors
 * @param  {boolean} noColors - disable chalk colors
 * @return {object} - default or custom chalk instance
 */
const safeChalk = function (noColors) {
  if (noColors) {
    const colorlessChalk = new ChalkInstance({ level: 0 })
    return colorlessChalk
  }
  return new ChalkInstance()
}

const chalk = safeChalk(argv.includes('--json'))

/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
const padLeft = (str, count, filler = ' ') => str.padStart(str.length + count, filler)

const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

/** A list of base command flags that needs to be sorted down on documentation and on help pages */
const BASE_FLAGS = new Set(['--debug', '--httpProxy', '--httpProxyCertificateFilename'])

// eslint-disable-next-line no-magic-numbers
const NETLIFY_CYAN = chalk.rgb(40, 180, 170)

const NETLIFYDEV = `${chalk.greenBright('◈')} ${NETLIFY_CYAN('Netlify Dev')} ${chalk.greenBright('◈')}`
const NETLIFYDEVLOG = `${chalk.greenBright('◈')}`
const NETLIFYDEVWARN = `${chalk.yellowBright('◈')}`
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
const sortOptions = (optionA, optionB) => {
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
const pollForToken = async ({ api, ticket }) => {
  const spinner = startSpinner({ text: 'Waiting for authorization...' })
  try {
    const accessToken = await api.getAccessToken(ticket, { timeout: TOKEN_TIMEOUT })
    if (!accessToken) {
      error('Could not retrieve access token')
    }
    return accessToken
  } catch (error_) {
    if (error_.name === 'TimeoutError') {
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
const getToken = async (tokenFromOptions) => {
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
const logJson = (message = '') => {
  if (argv.includes('--json') || isDefaultJson()) {
    process.stdout.write(JSON.stringify(message, null, 2))
  }
}

const log = (message = '', ...args) => {
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
const error = (message = '', options = {}) => {
  const err = message instanceof Error ? message : new Error(message)
  if (options.exit === false) {
    const bang = chalk.red(BANG)
    if (process.env.DEBUG) {
      process.stderr.write(` ${bang}   Warning: ${err.stack.split('\n').join(`\n ${bang}   `)}`)
    } else {
      process.stderr.write(` ${bang}   ${chalk.red(`${err.name}:`)} ${err.message}\n`)
    }
  } else {
    throw err
  }
}

const exit = (code = 0) => {
  process.exit(code)
}

// When `build.publish` is not set by the user, the CLI behavior differs in
// several ways. It detects it by checking if `build.publish` is `undefined`.
// However, `@netlify/config` adds a default value to `build.publish`.
// This removes it.
const normalizeConfig = (config) =>
  config.build.publishOrigin === 'default'
    ? { ...config, build: omit(config.build, ['publish', 'publishOrigin']) }
    : config

module.exports = {
  BANG,
  chalk,
  error,
  exit,
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
}
