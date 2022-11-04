// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dirname'.
const { dirname, extname, join, resolve } = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'platform'.
const { platform } = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'findUp'.
const findUp = require('find-up')
const toml = require('toml')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isWindows'... Remove this comment to see the full error message
const isWindows = platform === 'win32'

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const { execa } = require('../../../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const { getPathInProject } = require('../../../settings.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'runFunctio... Remove this comment to see the full error message
const { runFunctionsProxy } = require('../../local-proxy.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'build'.
const build = async ({ func }) => {
  const functionDirectory = dirname(func.mainFile)
  const cacheDirectory = resolve(getPathInProject(['functions-serve']))
  const targetDirectory = join(cacheDirectory, func.name)
  const crateName = await getCrateName(functionDirectory)
  // @ts-expect-error TS(2774): This condition will always return true since this ... Remove this comment to see the full error message
  const binaryName = `${crateName}${isWindows ? '.exe' : ''}`
  const binaryPath = join(targetDirectory, 'debug', binaryName)

  await execa('cargo', ['build', '--target-dir', targetDirectory], {
    cwd: functionDirectory,
  })

  return {
    binaryPath,
    srcFiles: [functionDirectory],
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getBuildFu... Remove this comment to see the full error message
const getBuildFunction =
  // @ts-expect-error TS(7031): Binding element 'func' implicitly has an 'any' typ... Remove this comment to see the full error message
  ({ func }) =>
  () =>
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    build({ func })

// @ts-expect-error TS(7006): Parameter 'cwd' implicitly has an 'any' type.
const getCrateName = async (cwd) => {
  const manifestPath = await findUp('Cargo.toml', { cwd, type: 'file' })
  const manifest = await readFile(manifestPath, 'utf-8')
  // @ts-expect-error TS(1212): Identifier expected. 'package' is a reserved word ... Remove this comment to see the full error message
  const { package } = toml.parse(manifest)

  // @ts-expect-error TS(1212): Identifier expected. 'package' is a reserved word ... Remove this comment to see the full error message
  return package.name
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'invokeFunc... Remove this comment to see the full error message
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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'onRegister... Remove this comment to see the full error message
const onRegister = (func) => {
  const isSource = extname(func.mainFile) === '.rs'

  return isSource ? func : null
}

module.exports = { getBuildFunction, invokeFunction, name: 'rs', onRegister }
