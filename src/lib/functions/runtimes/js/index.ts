import { createConnection } from 'net'
import { dirname } from 'path'
import { pathToFileURL } from 'url'
import { Worker } from 'worker_threads'

import lambdaLocal, { type LambdaEvent } from 'lambda-local'

import type { BuildFunction, GetBuildFunction, InvokeFunction } from '../index.js'
import { BLOBS_CONTEXT_VARIABLE } from '../../../blobs/blobs.js'
import type NetlifyFunction from '../../netlify-function.js'

import detectZisiBuilder, { getFunctionMetadata, ZisiBuildResult } from './builders/zisi.js'
import { SECONDS_TO_MILLISECONDS } from './constants.js'
import type { WorkerMessage } from './worker.js'

export const name = 'js'

type SimpleJsBuildResult = {
  schedule?: string
  srcFiles: string[]
}

export type JsBuildResult = ZisiBuildResult | SimpleJsBuildResult

// TODO(serhalp): Unify these. This is bonkers that the two underlying invocation mechanisms are encapsulated but we
// return slightly different shapes for them.
export type JsInvokeFunctionResult = WorkerMessage | LambdaEvent

lambdaLocal.getLogger().level = 'alert'

export async function getBuildFunction({
  config,
  directory,
  errorExit,
  func,
  projectRoot,
}: Parameters<GetBuildFunction<JsBuildResult>>[0]) {
  const metadata = await getFunctionMetadata({ mainFile: func.mainFile, config, projectRoot })
  const zisiBuilder = await detectZisiBuilder({ config, directory, errorExit, func, metadata, projectRoot })

  if (zisiBuilder) {
    return zisiBuilder.build
  }

  // If there's no function builder, we create a simple one on-the-fly which
  // returns as `srcFiles` the function directory, if there is one, or its
  // main file otherwise.
  const functionDirectory = dirname(func.mainFile)
  const srcFiles = functionDirectory === directory ? [func.mainFile] : [functionDirectory]

  const build: BuildFunction<JsBuildResult> = () => Promise.resolve({ schedule: metadata?.schedule, srcFiles })
  return build
}

const workerURL = new URL('worker.js', import.meta.url)

export const invokeFunction = async ({
  context,
  environment,
  event,
  func,
  timeout,
}: Parameters<InvokeFunction<JsBuildResult>>[0]): Promise<JsInvokeFunctionResult> => {
  const { buildData } = func
  // I have no idea why, but it appears that treating the case of a missing `buildData` or missing
  // `buildData.runtimeAPIVersion` as V1 is important.
  const runtimeAPIVersion =
    buildData != null && 'runtimeAPIVersion' in buildData && typeof buildData.runtimeAPIVersion === 'number'
      ? buildData.runtimeAPIVersion
      : null
  if (runtimeAPIVersion == null || runtimeAPIVersion !== 2) {
    return await invokeFunctionDirectly({
      context,
      environment: environment as Record<string, string>,
      event,
      func,
      timeout,
    })
  }

  const workerData = {
    clientContext: JSON.stringify(context),
    environment,
    event,
    // If a function builder has defined a `buildPath` property, we use it.
    // Otherwise, we'll invoke the function's main file.
    // Because we use import() we have to use file:// URLs for Windows.
    entryFilePath: pathToFileURL(
      buildData != null && 'buildPath' in buildData && buildData.buildPath ? buildData.buildPath : func.mainFile,
    ).href,
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
  }

  const worker = new Worker(workerURL, { workerData })
  return await new Promise((resolve, reject) => {
    worker.on('message', (result: WorkerMessage): void => {
      // TODO(serhalp): Improve `WorkerMessage` type. It sure would be nice to keep it simple as it
      // is now, but technically this is an arbitrary type from the user function return...
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (result?.streamPort != null) {
        const client = createConnection(
          {
            port: result.streamPort,
            host: 'localhost',
          },
          () => {
            result.body = client
            resolve(result)
          },
        )
        client.on('error', reject)
      } else {
        resolve(result)
      }
    })

    worker.on('error', reject)
  })
}

export const invokeFunctionDirectly = async <BuildResult extends JsBuildResult>({
  context,
  environment,
  event,
  func,
  timeout,
}: {
  context: Record<string, unknown>
  environment: Record<string, string>
  event: Record<string, unknown>
  func: NetlifyFunction<BuildResult>
  timeout: number
}): Promise<LambdaEvent> => {
  const buildData = await func.getBuildData()
  if (buildData == null) {
    throw new Error('Cannot invoke a function that has not been built')
  }
  // If a function builder has defined a `buildPath` property, we use it.
  // Otherwise, we'll invoke the function's main file.
  const lambdaPath =
    'buildPath' in buildData && typeof buildData.buildPath === 'string' ? buildData.buildPath : func.mainFile
  const result = await lambdaLocal.execute({
    clientContext: JSON.stringify(context),
    environment: {
      // Include environment variables from config
      ...environment,
      // We've set the Blobs context on the parent process, which means it will
      // be available to the Lambda. This would be inconsistent with production
      // where only V2 functions get the context injected. To fix it, unset the
      // context variable before invoking the function.
      // This has the side-effect of also removing the variable from `process.env`.
      [BLOBS_CONTEXT_VARIABLE]: undefined,
    },
    event,
    lambdaPath,
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
    verboseLevel: 3,
    esm: lambdaPath.endsWith('.mjs'),
  })

  return result
}
