import express from 'express'

import { NETLIFYDEVERR, NETLIFYDEVLOG } from '../../utils/command-helpers.js'

import { formatLambdaError, styleFunctionName } from './utils.js'
import type { InvocationError } from './netlify-function.js'

const BACKGROUND_FUNCTION_STATUS_CODE = 202

export const handleBackgroundFunction = (functionName: string, response: express.Response): void => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()
}

export const handleBackgroundFunctionResult = (functionName: string, err: null | Error | InvocationError): void => {
  if (err) {
    console.log(
      `${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`,
      formatLambdaError(err),
    )
  } else {
    console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`)
  }
}
