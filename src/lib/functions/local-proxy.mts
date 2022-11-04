// @ts-check
const { stdout } = require('process')

const { getBinaryPath: getFunctionsProxyPath } = require('@netlify/local-functions-proxy')


const { execa } = require('../../utils/index.mjs')


const runFunctionsProxy = ({
  binaryPath,
  context,
  directory,
  event,
  name,
  timeout

}: $TSFixMe) => {
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
  const proxyProcess = execa(functionsProxyPath, parameters)

  proxyProcess.stderr.pipe(stdout)

  return proxyProcess
}

export default { runFunctionsProxy }
