import { readFile } from 'fs/promises'
import { dirname, extname, join, resolve } from 'path'
import { platform } from 'process'

import { findUp } from 'find-up'
import type { LambdaEvent } from 'lambda-local'
import toml from 'toml'

import type {
  BaseBuildResult,
  BuildFunction,
  GetBuildFunctionOpts,
  InvokeFunction,
  OnRegisterFunction,
} from '../index.js'
import execa from '../../../../utils/execa.js'
import { SERVE_FUNCTIONS_FOLDER } from '../../../../utils/functions/functions.js'
import { getPathInProject } from '../../../settings.js'
import { runFunctionsProxy } from '../../local-proxy.js'
import type NetlifyFunction from '../../netlify-function.js'

const isWindows = platform === 'win32'

export const name = 'rs'

export type RustBuildResult = BaseBuildResult & {
  binaryPath: string
}

export type RustInvokeFunctionResult = LambdaEvent

const build = async ({ func }: { func: NetlifyFunction<RustBuildResult> }): Promise<RustBuildResult> => {
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

/* eslint-disable @typescript-eslint/require-await -- Must be async to match the interface */
export const getBuildFunction =
  async ({ func }: GetBuildFunctionOpts<RustBuildResult>): Promise<BuildFunction<RustBuildResult>> =>
  async () =>
    build({ func })
/* eslint-enable @typescript-eslint/require-await -- Can't use `eslint-disable-next-line` due to prettier bug 😅 */

const getCrateName = async (cwd: string): Promise<string> => {
  const manifestPath = await findUp('Cargo.toml', { cwd, type: 'file' })
  if (!manifestPath) {
    throw new Error('Cargo.toml not found')
  }

  const parsedManifest = toml.parse(await readFile(manifestPath, 'utf-8')) as unknown
  // TODO(serhalp) Also validate `.package.name`?
  if (parsedManifest == null || typeof parsedManifest !== 'object' || !('package' in parsedManifest)) {
    throw new Error('Cargo.toml is missing or invalid')
  }
  const { package: CargoPackage } = parsedManifest as { package: { name: string } }

  return CargoPackage.name
}

export const invokeFunction: InvokeFunction<RustBuildResult> = async ({ context, event, func, timeout }) => {
  if (func.buildData == null) {
    throw new Error('Cannot invoke a function that has not been built')
  }
  const { stdout } = await runFunctionsProxy({
    binaryPath: func.buildData.binaryPath,
    context,
    directory: dirname(func.mainFile),
    event,
    name: func.name,
    timeout,
  })

  try {
    const { body, headers, multiValueHeaders, statusCode } = JSON.parse(stdout) as LambdaEvent

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

export const onRegister: OnRegisterFunction<RustBuildResult> = (func) => {
  const isSource = extname(func.mainFile) === '.rs'

  return isSource ? func : null
}
