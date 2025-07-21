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

export const formatLambdaError = (err: Error | InvocationError): string =>
  chalk.red(
    `${'errorType' in err ? err.errorType : 'Error'}: ${'errorMessage' in err ? err.errorMessage : err.message}`,
  )

export const styleFunctionName = (name: string): string => chalk.magenta(name)
