const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils/logo')

const { formatLambdaError, styleFunctionName } = require('./utils')

const SCHEDULED_FUNCTION_STATUS_CODE = 202

const handleScheduledFunction = (functionName, response) => {
  console.log(`${NETLIFYDEVLOG} Running scheduled function ${styleFunctionName(functionName)}`)
  response.status(SCHEDULED_FUNCTION_STATUS_CODE)
  response.end()
}

const handleScheduledFunctionResult = (functionName, err) => {
  if (err) {
    console.log(
      `${NETLIFYDEVERR} Error during scheduled function ${styleFunctionName(functionName)} execution:`,
      formatLambdaError(err),
    )
  } else {
    console.log(`${NETLIFYDEVLOG} Done executing scheduled function ${styleFunctionName(functionName)}`)
  }
}

module.exports = { handleScheduledFunction, handleScheduledFunctionResult }
