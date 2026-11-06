import { chalk, warn } from '../../utils/command-helpers.js'
import { MISSING_AWS_SDK_WARNING } from '../log.js'

import type { InvocationError } from './netlify-function.js'

export const warnIfAwsSdkError = ({ error }: { error: Error | InvocationError | string }): void => {
  const isAwsSdkError =
    typeof error === 'object' &&
    'errorMessage' in error &&
    typeof error.errorMessage === 'string' &&
    error.errorMessage.includes("Cannot find module 'aws-sdk'")

  if (isAwsSdkError) {
    warn(MISSING_AWS_SDK_WARNING)
  }
}

// `err` is typed as `unknown` because functions can throw anything, e.g. a string, which `in` would throw on
export const formatLambdaError = (err: unknown): string => {
  if (typeof err !== 'object' || err === null) {
    return chalk.red(`Error: ${String(err)}`)
  }

  const errorType = 'errorType' in err ? err.errorType : 'Error'
  const errorMessage = 'errorMessage' in err ? err.errorMessage : 'message' in err ? err.message : ''

  return chalk.red(`${String(errorType)}: ${String(errorMessage)}`)
}

export const styleFunctionName = (name: string): string => chalk.magenta(name)
