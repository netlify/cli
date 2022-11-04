
const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils/index.mjs')


const { formatLambdaError, styleFunctionName } = require('./utils.mjs')

const BACKGROUND_FUNCTION_STATUS_CODE = 202


const handleBackgroundFunction = (functionName: $TSFixMe, response: $TSFixMe) => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()
}


const handleBackgroundFunctionResult = (functionName: $TSFixMe, err: $TSFixMe) => {
  if (err) {
    console.log(
      `${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`,
      formatLambdaError(err),
    )
  } else {
    console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`)
  }
}

export default { handleBackgroundFunction, handleBackgroundFunctionResult }
