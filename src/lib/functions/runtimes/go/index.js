// @ts-check
const { dirname, extname } = require('path')
const { platform } = require('process')

const tempy = require('tempy')

const isWindows = platform === 'win32'

const { execa } = require('../../../../utils')
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
  } catch {
    return false
  }
}

const getBuildFunction = ({ func }) => {
  const functionDirectory = dirname(func.mainFile)
  const binaryPath = tempy.file(isWindows ? { extension: 'exe' } : undefined)

  return () => build({ binaryPath, functionDirectory })
}

const invokeFunction = async ({ context, event, func, timeout }) => {
  const { stdout } = await runFunctionsProxy({
    binaryPath: func.buildData.binaryPath,
    context,
    directory: dirname(func.mainFile),
    event,
    name: func.name,
    timeout,
  })

  try {
    const { body, headers, multiValueHeaders, statusCode } = JSON.parse(stdout)

    return {
      body,
      headers,
      multiValueHeaders,
      statusCode,
    }
  } catch {
    return {
      statusCode: 500,
    }
  }
}

const onRegister = (func) => {
  const isSource = extname(func.mainFile) === '.go'

  return isSource ? func : null
}

module.exports = { getBuildFunction, invokeFunction, name: 'go', onRegister }
