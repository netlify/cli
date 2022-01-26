// @ts-check
import { chalk, warn } from '../../utils/index.js'
import { getLogMessage } from '../log.js'

export const DEFAULT_LAMBDA_OPTIONS = {
  verboseLevel: 3,
}

export const SECONDS_TO_MILLISECONDS = 1000

export const detectAwsSdkError = ({ error }) => {
  const isAwsSdkError = error && error.errorMessage && error.errorMessage.includes("Cannot find module 'aws-sdk'")

  if (isAwsSdkError) {
    warn(getLogMessage('functions.missingAwsSdk'))
  }
}

export const formatLambdaError = (err) => chalk.red(`${err.errorType}: ${err.errorMessage}`)

// should be equivalent to https://github.com/netlify/proxy/blob/main/pkg/functions/request.go#L105
const exceptionsList = new Set([
  'application/csp-report',
  'application/graphql',
  'application/json',
  'application/javascript',
  'application/x-www-form-urlencoded',
  'application/x-ndjson',
  'application/xml',
])

/**
 * @param {string | undefined} contentType
 * @returns {boolean}
 */
export const shouldBase64Encode = function (contentType) {
  if (!contentType) {
    return true
  }

  contentType = contentType.toLowerCase()

  if (contentType.startsWith('text/')) {
    return false
  }

  if (contentType.endsWith('+json') || contentType.endsWith('+xml')) {
    return false
  }

  if (exceptionsList.has(contentType)) {
    return false
  }

  return true
}

export const styleFunctionName = (name) => chalk.magenta(name)
