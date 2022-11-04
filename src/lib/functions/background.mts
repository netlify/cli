// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'formatLamb... Remove this comment to see the full error message
const { formatLambdaError, styleFunctionName } = require('./utils.cjs')

const BACKGROUND_FUNCTION_STATUS_CODE = 202

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'handleBack... Remove this comment to see the full error message
const handleBackgroundFunction = (functionName: $TSFixMe, response: $TSFixMe) => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'handleBack... Remove this comment to see the full error message
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

module.exports = { handleBackgroundFunction, handleBackgroundFunctionResult }
