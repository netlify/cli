import { Buffer } from 'buffer'
import { inspect } from 'util'

import express from 'express'
import type { LambdaEvent } from 'lambda-local'

import { chalk, logPadded, NETLIFYDEVERR } from '../../utils/command-helpers.js'
import renderErrorTemplate from '../render-error-template.js'

import { detectAwsSdkError } from './utils.js'
import type { InvocationError } from './netlify-function.js'
import { isReadable } from 'stream'

const addHeaders = (headers: undefined | Record<string, string | string[]>, response: express.Response): void => {
  if (!headers) {
    return
  }

  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value)
  })
}

export const handleSynchronousFunction = async function ({
  error: invocationError,
  functionName,
  request,
  response,
  result,
}: {
  error: null | Error | InvocationError
  functionName: string
  request: express.Request
  response: express.Response
  result: null | LambdaEvent
}): Promise<void> {
  if (invocationError) {
    const error = getNormalizedError(invocationError)

    logPadded(
      `${NETLIFYDEVERR} Function ${chalk.yellow(functionName)} has returned an error: ${
        error.errorMessage
      }\n${chalk.dim(error.stackTrace.join('\n'))}`,
    )

    await handleErr(invocationError, request, response)
    return
  }

  const { error } = validateLambdaResponse(result)
  if (error) {
    logPadded(`${NETLIFYDEVERR} ${error}`)

    await handleErr(error, request, response)
    return
  }

  // This shouldn't happen (see `InvokeFunctionResult`), but due to type lossiness TS doesn't know this here.
  if (result == null) {
    logPadded(`${NETLIFYDEVERR} Unexpected empty function response`)

    await handleErr('Unexpected empty function response', request, response)
    return
  }

  if (result.statusCode != null) {
    response.statusCode = result.statusCode
  }

  try {
    addHeaders(result.headers, response)
    addHeaders(result.multiValueHeaders, response)
  } catch (headersError) {
    const wrappedHeadersError = headersError instanceof Error ? headersError : new Error(headersError?.toString())
    const normalizedError = getNormalizedError(wrappedHeadersError)

    logPadded(
      `${NETLIFYDEVERR} Failed to set header in function ${chalk.yellow(functionName)}: ${
        normalizedError.errorMessage
      }`,
    )

    await handleErr(wrappedHeadersError, request, response)
    return
  }

  if (result.body) {
    if (isReadable(result.body as NodeJS.ReadableStream)) {
      (result.body as NodeJS.ReadableStream).pipe(response)

      return
    }
    response.write(result.isBase64Encoded ? Buffer.from(result.body as string, 'base64') : result.body)
  }
  response.end()
}

/**
 * Accepts an error generated by `lambda-local` or an instance of `Error` and
 * returns a normalized error that we can treat in the same way.
 */
const getNormalizedError = (error: Error | InvocationError): InvocationError => {
  if (error instanceof Error) {
    const normalizedError: InvocationError = {
      errorMessage: error.message,
      errorType: error.name,
      stackTrace: error.stack ? error.stack.split('\n') : [],
    }

    if ('code' in error && error.code === 'ERR_REQUIRE_ESM') {
      return {
        ...normalizedError,
        errorMessage:
          'a CommonJS file cannot import ES modules. Consider switching your function to ES modules. For more information, refer to https://ntl.fyi/functions-runtime.',
      }
    }

    return normalizedError
  }

  // Formatting stack trace lines in the same way that Node.js formats native errors.
  const stackTrace = error.stackTrace.map((line) => `    at ${line}`)

  return {
    errorType: error.errorType,
    errorMessage: error.errorMessage,
    stackTrace,
  }
}

const formatLambdaLocalError = (rawError: Error | InvocationError, acceptsHTML: boolean) => {
  const error = getNormalizedError(rawError)

  if (acceptsHTML) {
    return JSON.stringify({
      ...error,
      stackTrace: undefined,
      trace: error.stackTrace,
    })
  }

  return `${error.errorType}: ${error.errorMessage}\n ${error.stackTrace.join('\n')}`
}

const handleErr = async (
  err: Error | InvocationError | string,
  request: express.Request,
  response: express.Response,
) => {
  // @ts-expect-error -- XXX(serhalp): Expects `error` but passes `err`, so it has never worked. Fixed in stacked PR.
  detectAwsSdkError({ err })

  const acceptsHtml = request.headers.accept?.includes('text/html') ?? false
  const errorString = typeof err === 'string' ? err : formatLambdaLocalError(err, acceptsHtml)

  response.statusCode = 500

  if (acceptsHtml) {
    response.setHeader('Content-Type', 'text/html')
    response.end(await renderErrorTemplate(errorString, '../../src/lib/templates/function-error.html', 'function'))
  } else {
    response.end(errorString)
  }
}

const validateLambdaResponse = (lambdaResponse: undefined | null | LambdaEvent): { error?: undefined | string } => {
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
      error: `Your function response must have a numerical statusCode. You gave: ${inspect(lambdaResponse.statusCode)}`,
    }
  }
  if (lambdaResponse.body && typeof lambdaResponse.body !== 'string' && !isReadable(lambdaResponse.body)) {
    return {
      error: `Your function response must have a string or a stream body. You gave: ${inspect(lambdaResponse.body)}`,
    }
  }

  return {}
}
