import { dirname, extname } from 'path'
import { platform } from 'process'

import { temporaryFile } from 'tempy'

import type {
  BaseBuildResult,
  BuildFunction,
  GetBuildFunctionOpts,
  InvokeFunction,
  OnRegisterFunction,
} from '../index.js'
import execa from '../../../../utils/execa.js'
import { runFunctionsProxy } from '../../local-proxy.js'

const isWindows = platform === 'win32'

export const name = 'go'

export type GoBuildResult = BaseBuildResult & {
  binaryPath: string
}

const build = async ({
  binaryPath,
  functionDirectory,
}: {
  binaryPath: string
  functionDirectory: string
}): Promise<GoBuildResult> => {
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

const checkGoInstallation = async ({ cwd }: { cwd: string }): Promise<boolean> => {
  try {
    await execa('go', ['version'], { cwd })

    return true
  } catch {
    return false
  }
}

export const getBuildFunction = async ({
  func,
}: // eslint-disable-next-line @typescript-eslint/require-await -- Must be async to match the interface
GetBuildFunctionOpts<GoBuildResult>): Promise<BuildFunction<GoBuildResult>> => {
  const functionDirectory = dirname(func.mainFile)
  const binaryPath = temporaryFile(isWindows ? { extension: 'exe' } : undefined)

  return async () => build({ binaryPath, functionDirectory })
}

export const invokeFunction: InvokeFunction<GoBuildResult> = async ({ context, event, func, timeout }) => {
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

export const onRegister: OnRegisterFunction<GoBuildResult> = (func) => {
  const isSource = extname(func.mainFile) === '.go'

  return isSource ? func : null
}
