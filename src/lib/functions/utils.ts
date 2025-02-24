import { ansis, warn } from '../../utils/command-helpers.js'
import { MISSING_AWS_SDK_WARNING } from '../log.js'

import type { InvocationError } from './netlify-function.js'

// TODO(serhalp): Rename? This doesn't "detect", it maybe logs a warning.
export const detectAwsSdkError = ({ error }: { error: Error | InvocationError | string }): void => {
  const isAwsSdkError =
    typeof error === 'object' &&
    'errorMessage' in error &&
    typeof error.errorMessage === 'string' &&
    error.errorMessage.includes("Cannot find module 'aws-sdk'")

  if (isAwsSdkError) {
    warn(MISSING_AWS_SDK_WARNING)
  }
}

// XXX(serhalp): This appears to be a bug? In the background and scheduled function code paths this can receive plain
// errors, but this is assuming normalized `InvocationError`s only.
export const formatLambdaError = (err: Error | InvocationError): string =>
  ansis.red(`${'errorType' in err ? err.errorType : ''}: ${'errorMessage' in err ? err.errorMessage : ''}`)

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

export const shouldBase64Encode = function (contentType?: string): boolean {
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

export const styleFunctionName = (name: string): string => ansis.magenta(name)
