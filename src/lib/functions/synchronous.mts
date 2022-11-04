// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Buffer'.
const { Buffer } = require('buffer')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR } = require('../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'renderErro... Remove this comment to see the full error message
const renderErrorTemplate = require('../render-error-remplate.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'detectAwsS... Remove this comment to see the full error message
const { detectAwsSdkError } = require('./utils.cjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const addHeaders = (headers: $TSFixMe, response: $TSFixMe) => {
  if (!headers) {
    return
  }

  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value)
  })
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'handleSync... Remove this comment to see the full error message
const handleSynchronousFunction = function (err: $TSFixMe, result: $TSFixMe, request: $TSFixMe, response: $TSFixMe) {
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

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const formatLambdaLocalError = (err: $TSFixMe, acceptsHtml: $TSFixMe) =>
  acceptsHtml
    ? JSON.stringify({
        errorType: err.errorType,
        errorMessage: err.errorMessage,
        trace: err.stackTrace,
      })
    : `${err.errorType}: ${err.errorMessage}\n ${err.stackTrace.join('\n ')}`

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const processRenderedResponse = async (err: $TSFixMe, request: $TSFixMe) => {
  const acceptsHtml = request.headers && request.headers.accept && request.headers.accept.includes('text/html')
  const errorString = typeof err === 'string' ? err : formatLambdaLocalError(err, acceptsHtml)

  return acceptsHtml
    ? await renderErrorTemplate(errorString, './templates/function-error.html', 'function')
    : errorString
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const handleErr = async (err: $TSFixMe, request: $TSFixMe, response: $TSFixMe) => {
  detectAwsSdkError({ err })

  response.statusCode = 500
  response.end(await processRenderedResponse(err, request))
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const validateLambdaResponse = (lambdaResponse: $TSFixMe) => {
  if (lambdaResponse === undefined) {
    return { error: 'lambda response was undefined. check your function code again' }
  }
  if (lambdaResponse === null) {
    return {
      error: 'no lambda response. check your function code again. make sure to return a promise or use the callback.',
    }
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
