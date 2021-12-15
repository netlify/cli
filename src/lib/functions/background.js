const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils')

const { formatLambdaError, styleFunctionName } = require('./utils')

const BACKGROUND_FUNCTION_STATUS_CODE = 202

const handleBackgroundFunction = (functionName, response) => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()
}

const handleBackgroundFunctionResult = (functionName, err) => {
  if (err) {
    console.log(
      `${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`,
      formatLambdaError(err),
    )
  } else {
    console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`)
  }
}

module.exports = { handleBackgroundFunction, handleBackgroundFunctionResult }
