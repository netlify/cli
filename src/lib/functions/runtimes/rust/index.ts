import { readFile } from 'fs/promises'
import { dirname, extname, join, resolve } from 'path'
import { platform } from 'process'

import { findUp } from 'find-up'
import toml from 'toml'

import type { GetBuildFunction, InvokeFunction, OnRegisterFunction } from '../index.js'
import execa from '../../../../utils/execa.js'
import { SERVE_FUNCTIONS_FOLDER } from '../../../../utils/functions/functions.js'
import { getPathInProject } from '../../../settings.js'
import { runFunctionsProxy } from '../../local-proxy.js'
import type NetlifyFunction from '../../netlify-function.js'

const isWindows = platform === 'win32'

export const name = 'rs'

const build = async ({ func }: { func: NetlifyFunction }) => {
  const functionDirectory = dirname(func.mainFile)
  const cacheDirectory = resolve(getPathInProject([SERVE_FUNCTIONS_FOLDER]))
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

export const getBuildFunction: GetBuildFunction =
  async ({ func }) =>
  async () =>
    build({ func })

const getCrateName = async (cwd: string): Promise<string> => {
  const manifestPath = await findUp('Cargo.toml', { cwd, type: 'file' })
  if (!manifestPath) {
    throw new Error('Cargo.toml not found')
  }

  const parsedManifest = toml.parse(await readFile(manifestPath, 'utf-8'))
  if (!parsedManifest?.package) {
    throw new Error('Cargo.toml is missing or invalid')
  }
  const { package: CargoPackage } = parsedManifest as { package: { name: string } }

  return CargoPackage.name
}

export const invokeFunction: InvokeFunction = async ({ context, event, func, timeout }) => {
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

export const onRegister: OnRegisterFunction = (func) => {
  const isSource = extname(func.mainFile) === '.rs'

  return isSource ? func : null
}
