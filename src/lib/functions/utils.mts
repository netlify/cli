// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, warn } = require('../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getLogMess... Remove this comment to see the full error message
const { getLogMessage } = require('../log.cjs')

const DEFAULT_LAMBDA_OPTIONS = {
  verboseLevel: 3,
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'SECONDS_TO... Remove this comment to see the full error message
const SECONDS_TO_MILLISECONDS = 1000

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'detectAwsS... Remove this comment to see the full error message
const detectAwsSdkError = ({
  error
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const isAwsSdkError = error && error.errorMessage && error.errorMessage.includes("Cannot find module 'aws-sdk'")

  if (isAwsSdkError) {
    warn(getLogMessage('functions.missingAwsSdk'))
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'formatLamb... Remove this comment to see the full error message
const formatLambdaError = (err: $TSFixMe) => chalk.red(`${err.errorType}: ${err.errorMessage}`)

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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'shouldBase... Remove this comment to see the full error message
const shouldBase64Encode = function (contentType: $TSFixMe) {
  if (!contentType) {
    return true
  }

  const [contentTypeSegment] = contentType.split(';')
  contentType = contentTypeSegment
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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'styleFunct... Remove this comment to see the full error message
const styleFunctionName = (name: $TSFixMe) => chalk.magenta(name)

module.exports = {
  detectAwsSdkError,
  DEFAULT_LAMBDA_OPTIONS,
  formatLambdaError,
  SECONDS_TO_MILLISECONDS,
  shouldBase64Encode,
  styleFunctionName,
}
