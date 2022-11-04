// @ts-check

const { readFile } = require('fs').promises

const { dirname, extname, join, resolve } = require('path')

const { platform } = require('process')


const findUp = require('find-up')
const toml = require('toml')


const isWindows = platform === 'win32'


const { execa } = require('../../../../utils/index.mjs')

const { getPathInProject } = require('../../../settings.cjs')

const { runFunctionsProxy } = require('../../local-proxy.cjs')


const build = async ({ func }: $TSFixMe) => {
  const functionDirectory = dirname(func.mainFile)
  const cacheDirectory = resolve(getPathInProject(['functions-serve']))
  const targetDirectory = join(cacheDirectory, func.name)
  const crateName = await getCrateName(functionDirectory)
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


const getBuildFunction =
  // @ts-expect-error TS(7031): Binding element 'func' implicitly has an 'any' typ... Remove this comment to see the full error message
  ({ func }) =>
  () =>
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


const invokeFunction = async ({ context, event, func, timeout }: $TSFixMe) => {
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


const onRegister = (func: $TSFixMe) => {
  const isSource = extname(func.mainFile) === '.rs'

  return isSource ? func : null
}

module.exports = { getBuildFunction, invokeFunction, name: 'rs', onRegister }
