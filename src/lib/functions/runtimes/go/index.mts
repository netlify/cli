// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dirname'.
const { dirname, extname } = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'platform'.
const { platform } = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'tempy'.
const tempy = require('tempy')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isWindows'... Remove this comment to see the full error message
const isWindows = platform === 'win32'

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const { execa } = require('../../../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'runFunctio... Remove this comment to see the full error message
const { runFunctionsProxy } = require('../../local-proxy.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'build'.
const build = async ({
  binaryPath,
  functionDirectory
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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

const checkGoInstallation = async ({
  cwd
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  try {
    await execa('go', ['version'], { cwd })

    return true
  } catch {
    return false
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getBuildFu... Remove this comment to see the full error message
const getBuildFunction = ({
  func
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const functionDirectory = dirname(func.mainFile)
  // @ts-expect-error TS(2774): This condition will always return true since this ... Remove this comment to see the full error message
  const binaryPath = tempy.file(isWindows ? { extension: 'exe' } : undefined)

  // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
  return () => build({ binaryPath, functionDirectory })
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'invokeFunc... Remove this comment to see the full error message
const invokeFunction = async ({
  context,
  event,
  func,
  timeout
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'onRegister... Remove this comment to see the full error message
const onRegister = (func: $TSFixMe) => {
  const isSource = extname(func.mainFile) === '.go'

  return isSource ? func : null
}

module.exports = { getBuildFunction, invokeFunction, name: 'go', onRegister }
