const { dirname } = require('path')
const { platform } = require('process')

const execa = require('execa')
const tempy = require('tempy')

const isWindows = platform === 'win32'

const { runFunctionsProxy } = require('../../local-proxy')

const build = async ({ binaryPath, functionDirectory }) => {
  try {
    await execa('go', ['build', '-o', binaryPath], { cwd: functionDirectory })

    return { binaryPath, srcFiles: [functionDirectory] }
  } catch (error) {
    const isGoInstalled = await checkGoInstallation({ cwd: functionDirectory })

    if (!isGoInstalled) {
      throw new Error(
        "You don't seem to have Go installed. Go to https://golang.org/doc/install for installation instructions.",
      )
    }

    throw error
  }
}

const checkGoInstallation = async ({ cwd }) => {
  try {
    await execa('go', ['version'], { cwd })

    return true
  } catch (_) {
    return false
  }
}

const getBuildFunction = ({ func }) => {
  const functionDirectory = dirname(func.mainFile)
  const binaryPath = tempy.file(isWindows ? { extension: 'exe' } : undefined)

  return () => build({ binaryPath, functionDirectory })
}

const invokeFunction = async ({ context, event, func, timeout }) => {
  const requestData = {
    ...event,
    requestContext: context,
  }
  const { stdout } = await runFunctionsProxy({
    binaryPath: func.buildData.binaryPath,
    directory: dirname(func.mainFile),
    name: func.name,
    requestData,
    timeout,
  })

  try {
    const { body, headers, statusCode } = JSON.parse(stdout)

    return {
      body,
      headers,
      statusCode,
    }
  } catch (error) {
    return {
      statusCode: 500,
    }
  }
}

module.exports = { getBuildFunction, invokeFunction, name: 'go' }
