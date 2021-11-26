// @ts-check
const os = require('os')
const process = require('process')
const { format, inspect } = require('util')

// eslint-disable-next-line local-rules/no-direct-chalk-import
const { Instance: ChalkInstance } = require('chalk')
const WSL = require('is-wsl')
const { default: omit } = require('omit.js')

const { name, version } = require('../../package.json')
const { clearSpinner, startSpinner } = require('../lib/spinner')

const getGlobalConfig = require('./get-global-config')

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

const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

const { NETLIFY_AUTH_TOKEN } = process.env

// eslint-disable-next-line no-magic-numbers
const NETLIFY_CYAN = chalk.rgb(40, 180, 170)

const NETLIFYDEV = `${chalk.greenBright('◈')} ${NETLIFY_CYAN('Netlify Dev')} ${chalk.greenBright('◈')}`
const NETLIFYDEVLOG = `${chalk.greenBright('◈')}`
const NETLIFYDEVWARN = `${chalk.yellowBright('◈')}`
const NETLIFYDEVERR = `${chalk.redBright('◈')}`

// eslint-disable-next-line id-length
const $ = NETLIFY_CYAN('$')

/**
 * Generates a CommandHelp section for the command
 * @param {string} commandName
 * @param {import('commander').Command} program
 */
const generateCommandsHelp = (commandName, program) => {
  const cmds = program.commands.filter((cmd) => cmd.name().startsWith(`${commandName}:`))

  if (cmds.length !== 0) {
    const longestName = Math.max(...cmds.map((cmd) => cmd.name().length)) + 1
    const table = cmds.map((cmd) => {
      const spacer = Array.from({ length: longestName - cmd.name().length })
        .fill()
        .join(' ')

      return `  ${$} ${cmd.name()}${spacer}  ${chalk.grey(cmd.description())}`
    })
    return `
${chalk.bold('COMMANDS')}
${table.join('\n')}`
  }
}

/**
 * Generates the help output for the examples
 * @param {string[]} examples
 * @returns {string}
 */
const generateExamplesHelp = (examples) => {
  if (examples.length !== 0) {
    return `
${chalk.bold('EXAMPLES')}
${examples.map((example) => `  ${$} ${example}`).join('\n')}`
  }
}

// Poll Token timeout 5 Minutes
const TOKEN_TIMEOUT = 3e5

/**
 *
 * @param {object} config
 * @param {import('netlify')} config.api
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
  } catch (caughtError) {
    if (caughtError.name === 'TimeoutError') {
      error(
        `Timed out waiting for authorization. If you do not have a ${chalk.bold.greenBright(
          'Netlify',
        )} account, please create one at ${chalk.magenta(
          'https://app.netlify.com/signup',
        )}, then run ${chalk.cyanBright('netlify login')} again.`,
      )
    } else {
      error(caughtError)
    }
  } finally {
    clearSpinner({ spinner })
  }
}

/**
 * Get a netlify token
 * @param {string} [tokenFromOptions] optional token from the provided --auth options
 * @returns
 */
const getToken = async (tokenFromOptions) => {
  // 1. First honor command flag --auth
  if (tokenFromOptions) {
    return [tokenFromOptions, 'flag']
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

// 'api' command uses JSON output by default
// 'functions:invoke' need to return the data from the function as is
const isDefaultJson = () => argv[0] === 'functions:invoke' || (argv[0] === 'api' && !argv.includes('--list'))

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

const warn = (message = '') => {
  // TODO check for better solution
  // Errors.warn(message)
}

const error = (message = '', options = {}) => {
  // TODO check for better solution
  // Errors.error(message, options)
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
  getToken,
  exit,
  logJson,
  log,
  warn,
  error,
  chalk,
  generateCommandsHelp,
  generateExamplesHelp,
  pollForToken,
  normalizeConfig,
  USER_AGENT,
  NETLIFYDEV,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  NETLIFYDEVERR,
}
