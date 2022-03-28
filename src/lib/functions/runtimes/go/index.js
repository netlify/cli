// @ts-check
const { readFile } = require('fs').promises
const { dirname, extname } = require('path')
const { platform } = require('process')

const findUp = require('find-up')
const tempy = require('tempy')
const toml = require('toml')

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

const parseForSchedule = async ({ cwd, functionName }) => {
  const manifestPath = await findUp('netlify.toml', { cwd, type: 'file' })
  const manifest = await readFile(manifestPath, 'utf-8')
  const { functions } = toml.parse(manifest)

  const scheduledFunc = functions[functionName]
  return scheduledFunc && scheduledFunc.schedule
}

const getBuildFunction = ({ func }) => {
  const functionDirectory = dirname(func.mainFile)
  const binaryPath = tempy.file(isWindows ? { extension: 'exe' } : undefined)

  return async () => {
    // From the current function directory, we look up parent directories for the netlify.toml file.
    // If we find one, we parse it to see if a schedule is defined for the current function. It's okay
    // if we don't find one, we just assume the function is not scheduled (i.e. undefined).
    const schedule = await parseForSchedule({ cwd: functionDirectory, functionName: func.name })

    const { binaryPath: newBinaryPath, srcFiles } = await build({
      binaryPath,
      functionDirectory,
    })

    return { binaryPath: newBinaryPath, srcFiles, schedule }
  }
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
    const { body, headers, statusCode } = JSON.parse(stdout)

    return {
      body,
      headers,
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
