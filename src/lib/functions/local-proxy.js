const { getBinaryPath: getFunctionsProxyPath } = require('@netlify/local-functions-proxy')

const execa = require('../../utils/execa')

const runFunctionsProxy = ({ binaryPath, context, directory, event, name, timeout }) => {
  const functionsProxyPath = getFunctionsProxyPath()
  const requestData = {
    resource: '',
    ...event,
    headers: {
      ...event.headers,
      'X-Amzn-Trace-Id': '1a2b3c4d5e6f',
    },
    requestContext: {
      ...context,
      httpMethod: event.httpMethod || 'GET',
      requestTimeEpoch: 0,
    },
  }

  if (functionsProxyPath === null) {
    throw new Error('Host machine does not support local functions proxy server')
  }

  const parameters = [
    '--event',
    JSON.stringify(requestData),
    '--command',
    binaryPath,
    '--working-dir',
    directory,
    '--name',
    name,
    '--timeout',
    `${timeout}s`,
  ]

  return execa(functionsProxyPath, parameters)
}

module.exports = { runFunctionsProxy }
