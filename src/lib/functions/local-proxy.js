const { getBinaryPath: getFunctionsProxyPath } = require('@netlify/local-functions-proxy')
const execa = require('execa')

const runFunctionsProxy = ({ binaryPath, directory, name, requestData, timeout }) => {
  const functionsProxyPath = getFunctionsProxyPath()

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
