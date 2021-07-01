const chalk = require('chalk')

const { getLogMessage } = require('../log')

const BASE_64_MIME_REGEXP = /image|audio|video|application\/pdf|application\/zip|applicaton\/octet-stream/i

const DEFAULT_LAMBDA_OPTIONS = {
  verboseLevel: 3,
}

const SECONDS_TO_MILLISECONDS = 1000

const detectAwsSdkError = ({ error, warn }) => {
  const isAwsSdkError = error.errorMessage && error.errorMessage.includes("Cannot find module 'aws-sdk'")

  if (isAwsSdkError) {
    warn(getLogMessage('functions.missingAwsSdk'))
  }
}

const formatLambdaError = (err) => chalk.red(`${err.errorType}: ${err.errorMessage}`)

const shouldBase64Encode = function (contentType) {
  return Boolean(contentType) && BASE_64_MIME_REGEXP.test(contentType)
}

const styleFunctionName = (name) => chalk.magenta(name)

module.exports = {
  detectAwsSdkError,
  DEFAULT_LAMBDA_OPTIONS,
  formatLambdaError,
  SECONDS_TO_MILLISECONDS,
  shouldBase64Encode,
  styleFunctionName,
}
