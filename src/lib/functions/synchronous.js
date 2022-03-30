// @ts-check
const { Buffer } = require('buffer')
const { readFileSync } = require('fs')
const { join } = require('path')

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

const handleSynchronousFunction = function (err, result, request, response) {
  if (err) {
    return handleErr(err, request, response)
  }

  const { error } = validateLambdaResponse(result)
  if (error) {
    console.log(`${NETLIFYDEVERR} ${error}`)
    return handleErr(error, request, response)
  }

  response.statusCode = result.statusCode
  addHeaders(result.headers, response)
  addHeaders(result.multiValueHeaders, response)

  if (result.body) {
    response.write(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body)
  }
  response.end()
}

const formatLambdaLocalError = (err, acceptsHtml) =>
  acceptsHtml
    ? JSON.stringify({
        errorType: err.errorType,
        errorMessage: err.errorMessage,
        trace: err.stackTrace,
      })
    : `${err.errorType}: ${err.errorMessage}\n ${err.stackTrace.join('\n ')}`

const renderErrorTemplate = (errString) => {
  const regexPattern = /<!--@ERROR-DETAILS-->/g
  const errorTemplateFile = readFileSync(join(__dirname, './templates/function-error.html'), 'utf-8')

  return errorTemplateFile.replace(regexPattern, errString)
}

const processRenderedResponse = (err, request) => {
  const acceptsHtml = request.headers && request.headers.accept && request.headers.accept.includes('text/html')
  const errorString = typeof err === 'string' ? err : formatLambdaLocalError(err, acceptsHtml)

  return acceptsHtml ? renderErrorTemplate(errorString) : errorString
}

const handleErr = function (err, request, response) {
  detectAwsSdkError({ err })

  response.statusCode = 500
  response.end(processRenderedResponse(err, request))
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
