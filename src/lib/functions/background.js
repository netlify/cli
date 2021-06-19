const lambdaLocal = require('lambda-local')

const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils/logo')

const { DEFAULT_LAMBDA_OPTIONS, formatLambdaError, SECONDS_TO_MILLISECONDS, styleFunctionName } = require('./utils')

const BACKGROUND_FUNCTION_STATUS_CODE = 202

const createBackgroundFunctionCallback = (functionName) => (err) => {
  if (err) {
    console.log(
      `${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`,
      formatLambdaError(err),
    )
  } else {
    console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`)
  }
}

const executeBackgroundFunction = ({ event, lambdaPath, timeout, clientContext, response, functionName }) => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()

  return lambdaLocal.execute({
    ...DEFAULT_LAMBDA_OPTIONS,
    event,
    lambdaPath,
    clientContext,
    callback: createBackgroundFunctionCallback(functionName),
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
  })
}

module.exports = { executeBackgroundFunction }
