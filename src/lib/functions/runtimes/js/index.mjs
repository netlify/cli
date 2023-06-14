import { dirname } from 'path'

import lambdaLocal from '@skn0tt/lambda-local'
import winston from 'winston'

import detectNetlifyLambdaBuilder from './builders/netlify-lambda.mjs'
import detectZisiBuilder, { parseFunctionForMetadata } from './builders/zisi.mjs'
import { SECONDS_TO_MILLISECONDS } from './constants.mjs'
import { createFunctionWorker } from './threads/create-function-worker.mjs'

export const name = 'js'

let netlifyLambdaDetectorCache

const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [new winston.transports.Console({ level: 'warn' })],
})

lambdaLocal.setLogger(logger)

// The netlify-lambda builder can't be enabled or disabled on a per-function
// basis and its detection mechanism is also quite expensive, so we detect
// it once and cache the result.
const detectNetlifyLambdaWithCache = () => {
  if (netlifyLambdaDetectorCache === undefined) {
    netlifyLambdaDetectorCache = detectNetlifyLambdaBuilder()
  }

  return netlifyLambdaDetectorCache
}

export const getBuildFunction = async ({ config, directory, errorExit, func, projectRoot }) => {
  const netlifyLambdaBuilder = await detectNetlifyLambdaWithCache()

  if (netlifyLambdaBuilder) {
    return netlifyLambdaBuilder.build
  }

  const metadata = await parseFunctionForMetadata({ mainFile: func.mainFile, config, projectRoot })
  const zisiBuilder = await detectZisiBuilder({ config, directory, errorExit, func, metadata, projectRoot })

  if (zisiBuilder) {
    return zisiBuilder.build
  }

  // If there's no function builder, we create a simple one on-the-fly which
  // returns as `srcFiles` the function directory, if there is one, or its
  // main file otherwise.
  const functionDirectory = dirname(func.mainFile)
  const srcFiles = functionDirectory === directory ? [func.mainFile] : [functionDirectory]

  return () => ({ schedule: metadata.schedule, srcFiles })
}

export const invokeFunction = ({ context, event, func, timeout }) =>
  createFunctionWorker({
    context,
    event,
    func,
    timeout,
  })

// unused right now
export const invokeFunctionDirectly = async ({ context, event, func, timeout }) => {
  // If a function builder has defined a `buildPath` property, we use it.
  // Otherwise, we'll invoke the function's main file.
  const lambdaPath = (func.buildData && func.buildData.buildPath) || func.mainFile
  const result = await lambdaLocal.execute({
    clientContext: JSON.stringify(context),
    event,
    lambdaPath,
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
    verboseLevel: 3,
  })

  return result
}

export const onDirectoryScan = async () => {
  const netlifyLambdaBuilder = await detectNetlifyLambdaWithCache()

  // Before we start a directory scan, we check whether netlify-lambda is being
  // used. If it is, we run it, so that the functions directory is populated
  // with the compiled files before the scan begins.
  if (netlifyLambdaBuilder) {
    await netlifyLambdaBuilder.build()
  }
}
