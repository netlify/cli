const process = require('process')
const { format, inspect } = require('util')

const argv = require('minimist')(process.argv.slice(2))
const omit = require('omit.js').default

const { startSpinner, clearSpinner } = require('../lib/spinner')

const chalkInstance = require('./chalk')
const getGlobalConfig = require('./get-global-config')

const { NETLIFY_AUTH_TOKEN } = process.env

// 5 Minutes
const TOKEN_TIMEOUT = 3e5

const chalk = chalkInstance(argv.json)

const pollForToken = async ({ api, ticket, exitWithError }) => {
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

const getCwd = () => argv.cwd || process.cwd()

const getAuthArg = () => {
  // If deploy command. Support shorthand 'a' flag
  if (argv && argv._ && argv._[0] === 'deploy') {
    return argv.auth || argv.a
  }
  return argv.auth
}

const getToken = async (authFromFlag) => {
  const tokenFromFlag = authFromFlag || getAuthArg(argv)

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

// 'api' command uses JSON output by default
// 'functions:invoke' need to return the data from the function as is
const isDefaultJson = () => argv._[0] === 'functions:invoke' || (argv._[0] === 'api' && argv.list !== true)

const logJson = (message = '') => {
  if (argv.json || isDefaultJson()) {
    process.stdout.write(JSON.stringify(message, null, 2))
  }
}

const log = (message = '', ...args) => {
  /* If  --silent or --json flag passed disable logger */
  if (argv.silent || argv.json || isDefaultJson()) {
    return
  }
  message = typeof message === 'string' ? message : inspect(message)
  process.stdout.write(`${format(message, ...args)}\n`)
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
  argv,
  getCwd,
  pollForToken,
  log,
  logJson,
  getToken,
  normalizeConfig,
  chalk,
}
