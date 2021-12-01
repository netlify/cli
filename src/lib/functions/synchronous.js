// @ts-check
const { Buffer } = require('buffer')

const { NETLIFYDEVERR } = require('../../utils')

const { detectAwsSdkError } = require('./utils')

const addHeaders = (headers, response) => {
  if (!headers) {
    return
  }

  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value)
  })
}

const handleSynchronousFunction = function (err, result, response) {
  if (err) {
    return handleErr(err, response)
  }

  const { error } = validateLambdaResponse(result)
  if (error) {
    console.log(`${NETLIFYDEVERR} ${error}`)
    return handleErr(error, response)
  }

  response.statusCode = result.statusCode
  addHeaders(result.headers, response)
  addHeaders(result.multiValueHeaders, response)

  if (result.body) {
    response.write(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body)
  }
  response.end()
}

const formatLambdaLocalError = (err) => `${err.errorType}: ${err.errorMessage}\n  ${err.stackTrace.join('\n  ')}`

const handleErr = function (err, response) {
  detectAwsSdkError({ err })

  response.statusCode = 500
  const errorString = typeof err === 'string' ? err : formatLambdaLocalError(err)
  response.end(errorString)
}

const validateLambdaResponse = (lambdaResponse) => {
  if (lambdaResponse === undefined) {
    return { error: 'lambda response was undefined. check your function code again' }
  }
  if (!Number(lambdaResponse.statusCode)) {
    return {
      error: `Your function response must have a numerical statusCode. You gave: $ ${lambdaResponse.statusCode}`,
    }
  }
  if (lambdaResponse.body && typeof lambdaResponse.body !== 'string') {
    return { error: `Your function response must have a string body. You gave: ${lambdaResponse.body}` }
  }

  return {}
}

module.exports = { handleSynchronousFunction }
