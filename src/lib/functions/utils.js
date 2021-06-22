const chalk = require('chalk')

const { NETLIFYDEVLOG } = require('../../utils/logo')
const { getLogMessage } = require('../log')

const BASE_64_MIME_REGEXP = /image|audio|video|application\/pdf|application\/zip|applicaton\/octet-stream/i

const DEFAULT_LAMBDA_OPTIONS = {
  verboseLevel: 3,
}

const SECONDS_TO_MILLISECONDS = 1000

const formatLambdaError = (err) => chalk.red(`${err.errorType}: ${err.errorMessage}`)

const logAfterAction = ({ path, action }) => {
  console.log(`${NETLIFYDEVLOG} ${path} ${action}, successfully reloaded!`)
}

const logBeforeAction = ({ path, action }) => {
  console.log(`${NETLIFYDEVLOG} ${path} ${action}, reloading...`)
}

const shouldBase64Encode = function (contentType) {
  return Boolean(contentType) && BASE_64_MIME_REGEXP.test(contentType)
}

const styleFunctionName = (name) => chalk.magenta(name)

const validateFunctions = function ({ functions, capabilities, warn }) {
  if (!capabilities.backgroundFunctions && functions.some(({ isBackground }) => isBackground)) {
    warn(getLogMessage('functions.backgroundNotSupported'))
  }
}

module.exports = {
  DEFAULT_LAMBDA_OPTIONS,
  formatLambdaError,
  logAfterAction,
  logBeforeAction,
  SECONDS_TO_MILLISECONDS,
  shouldBase64Encode,
  styleFunctionName,
  validateFunctions,
}
