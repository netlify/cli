// @ts-check
import { once } from 'events'
import os from 'os'
import process from 'process'
import { format, inspect } from 'util'

// eslint-disable-next-line no-restricted-imports
import chalkModule from 'chalk'
import chokidar from 'chokidar'
import decache from 'decache'
import WSL from 'is-wsl'
import debounce from 'lodash/debounce.js'
import terminalLink from 'terminal-link'

import { clearSpinner, startSpinner } from '../lib/spinner.cjs'

import getGlobalConfig from './get-global-config.mjs'
import getPackageJson from './get-package-json.mjs'

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
    const colorlessChalk = new chalkModule.Instance({ level: 0 })
    return colorlessChalk
  }
  return new chalkModule.Instance()
}

export const chalk = safeChalk(argv.includes('--json'))

/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
export const padLeft = (str, count, filler = ' ') => str.padStart(str.length + count, filler)

const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

const { name, version } = await getPackageJson()

export const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

/** A list of base command flags that needs to be sorted down on documentation and on help pages */
const BASE_FLAGS = new Set(['--debug', '--httpProxy', '--httpProxyCertificateFilename'])

export const BRAND = {
  COLORS: {
    BLUE: `#2451f5`,
    CYAN: `#5cebdf`,
    RED: `#7a122d`,
    YELLOW: `#b7790b`,
  },
  ICONS: {
    DIAMOND: '◈',
  },
}

export const BANG = process.platform === 'win32' ? '»' : '›'

// indent on commands or description on the help page
export const INDENT_WIDTHS = {
  HELP: 2,
  INFO: 4,
}

/**
 * Outputs an important log line in a standard Netlify-branded format
 * Use for initialising commands and other important headings
 * @param {string} message
 */
export const logH1 = ({ message }) => {
  if (message) {
    log()
    log(`${chalk.black(`✨`)} ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold(` ${message} `)} ${chalk.black(`✨`)}`)
    log()
  }
}

/**
 * Outputs a log in a standard format
 * to indicate the start of a sub-section of logs
 * during command initialisation
 * @param {string} message
 */
export const logH2 = ({ message }) => {
  if (message) {
    log(`${chalk.bgHex(BRAND.COLORS.CYAN).black(` ${BRAND.ICONS.DIAMOND} ${message} `)}`)
    log()
  }
}

/**
 * Outputs an info log in a standard format
 * intended to show heirarchy of information
 * @param {string} message
 * @param {dim} bool
 */
export const logInfo = ({ dim = false, message }) => {
  if (message) {
    switch (dim) {
      case true:
        log(`${chalk.dim(padLeft(`${BANG} ${message}`, INDENT_WIDTHS.INFO))}`)
        break
      default:
        log(padLeft(`${BANG} ${message}`, INDENT_WIDTHS.INFO))
    }
  }
}

export const logError = ({ message }) => {
  if (message) {
    log(`${chalk.bgHex(BRAND.COLORS.RED).whiteBright(` ${BRAND.ICONS.DIAMOND} ${message} `)}`)
    log()
  }
}

export const logWarn = ({ message }) => {
  if (message) {
    log(`${chalk.bgHex(BRAND.COLORS.YELLOW).whiteBright(` ${BRAND.ICONS.DIAMOND} ${message} `)}`)
    log()
  }
}

export const STATUS_MSG = {
  LOADED: chalk.green('Loaded'),
  RELOADED: chalk.green('Reloaded'),
  REMOVED: chalk.magenta('Removed'),
}

/**
 * Sorts two options so that the base flags are at the bottom of the list
 * @param {import('commander').Option} optionA
 * @param {import('commander').Option} optionB
 * @returns {number}
 * @example
 * options.sort(sortOptions)
 */
export const sortOptions = (optionA, optionB) => {
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
export const pollForToken = async ({ api, ticket }) => {
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
export const getToken = async (tokenFromOptions) => {
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
export const logJson = (message = '') => {
  if (argv.includes('--json') || isDefaultJson()) {
    process.stdout.write(JSON.stringify(message, null, 2))
  }
}

export const log = (message = '', ...args) => {
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
export const warn = (message = '') => {
  const bang = chalk.yellow(BANG)
  log(` ${bang}   Warning: ${message}`)
}

/**
 * throws an error or log it
 * @param {string|Error} message
 * @param {object} [options]
 * @param {boolean} [options.exit]
 */
export const error = (message = '', options = {}) => {
  // to do prefix with error thingy??
  const err = message instanceof Error ? message : new Error(message)
  if (options.exit === false) {
    const bang = chalk.red(BANG)
    if (process.env.DEBUG) {
      process.stderr.write(` ${bang}   Warning: ${err.stack.split('\n').join(`\n ${bang}   `)}\n`)
    } else {
      process.stderr.write(` ${bang}   ${chalk.red(`${err.name}:`)} ${err.message}\n`)
    }
  } else {
    throw err
  }
}

export const exit = (code = 0) => {
  process.exit(code)
}

// When `build.publish` is not set by the user, the CLI behavior differs in
// several ways. It detects it by checking if `build.publish` is `undefined`.
// However, `@netlify/config` adds a default value to `build.publish`.
// This removes 'publish' and 'publishOrigin' in this case.
export const normalizeConfig = (config) => {
  // Unused var here is in order to omit 'publish' from build config
  // eslint-disable-next-line no-unused-vars
  const { publish, publishOrigin, ...build } = config.build

  return publishOrigin === 'default' ? { ...config, build } : config
}

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
export const watchDebounced = async (target, { depth, onAdd = () => {}, onChange = () => {}, onUnlink = () => {} }) => {
  const watcher = chokidar.watch(target, { depth, ignored: /node_modules/, ignoreInitial: true })

  await once(watcher, 'ready')

  const debouncedOnChange = debounce(onChange, DEBOUNCE_WAIT)
  const debouncedOnUnlink = debounce(onUnlink, DEBOUNCE_WAIT)
  const debouncedOnAdd = debounce(onAdd, DEBOUNCE_WAIT)

  watcher
    .on('change', (path) => {
      decache(path)
      debouncedOnChange(path)
    })
    .on('unlink', (path) => {
      decache(path)
      debouncedOnUnlink(path)
    })
    .on('add', (path) => {
      decache(path)
      debouncedOnAdd(path)
    })

  return watcher
}

export const getTerminalLink = (text, url) => terminalLink(text, url, { fallback: () => `${text} ${url}` })
