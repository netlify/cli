// @ts-check
import { promises } from 'fs'
import { dirname, extname, join, resolve } from 'path'
import { platform } from 'process'

import findUp from 'find-up'
import toml from 'toml'

import { execa } from '../../../../utils/index.js'
import { getPathInProject } from '../../../settings.js'
import { runFunctionsProxy } from '../../local-proxy.js'

const isWindows = platform === 'win32'
const { readFile } = promises

const build = async ({ func }) => {
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

export const getBuildFunction =
  ({ func }) =>
  () =>
    build({ func })

const getCrateName = async (cwd) => {
  const manifestPath = await findUp('Cargo.toml', { cwd, type: 'file' })
  const manifest = await readFile(manifestPath, 'utf-8')
  const { package: name } = toml.parse(manifest)

  return name
}

export const invokeFunction = async ({ context, event, func, timeout }) => {
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
  } catch (error) {
    return {
      statusCode: 500,
    }
  }
}

export const onRegister = (func) => {
  const isSource = extname(func.mainFile) === '.rs'

  return isSource ? func : null
}

export const name = 'rs'
