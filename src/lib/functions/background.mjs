import { logError, logH2 } from '../../utils/command-helpers.mjs'

import { formatLambdaError, styleFunctionName } from './utils.mjs'

const BACKGROUND_FUNCTION_STATUS_CODE = 202

export const handleBackgroundFunction = (functionName, response) => {
  logH2({ message: `Queueing background function ${styleFunctionName(functionName)} for execution` })
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()
}

export const handleBackgroundFunctionResult = (functionName, err) => {
  if (err) {
    logError({
      message: `Error during background function ${styleFunctionName(functionName)} execution:
      ${formatLambdaError(err)}`,
    })
  } else {
    logH2({ message: `Done executing background function ${styleFunctionName(functionName)}` })
  }
}
