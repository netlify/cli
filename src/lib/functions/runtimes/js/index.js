const { dirname } = require('path')

const lambdaLocal = require('lambda-local')
const winston = require('winston')

const detectNetlifyLambdaBuilder = require('./builders/netlify-lambda')
const detectZisiBuilder = require('./builders/zisi')

const SECONDS_TO_MILLISECONDS = 1e3

let cachedNetlifyLambdaDetector

const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [new winston.transports.Console({ level: 'warn' })],
})

lambdaLocal.setLogger(logger)

const getBuildFunction = async ({ config, errorExit, func, functionsDirectory, projectRoot }) => {
  // The netlify-lambda builder can't be enabled or disabled on a per-function
  // basis and its detection mechanism is also quite expensive, so we detect
  // it once and cache the result.
  if (cachedNetlifyLambdaDetector === undefined) {
    cachedNetlifyLambdaDetector = detectNetlifyLambdaBuilder()
  }

  const netlifyLambdaBuilder = await cachedNetlifyLambdaDetector

  if (netlifyLambdaBuilder) {
    return netlifyLambdaBuilder.build
  }

  const zisiBuilder = await detectZisiBuilder({ config, errorExit, func, functionsDirectory, projectRoot })

  if (zisiBuilder) {
    return zisiBuilder.build
  }

  // If there's no function builder, we create a simple one on-the-fly which
  // returns as `srcFiles` the function directory, if there is one, or its
  // main file otherwise.
  const functionDirectory = dirname(func.mainFile)
  const srcFiles = functionDirectory === functionsDirectory ? [func.mainFile] : [functionDirectory]

  return () => ({ srcFiles })
}

const invokeFunction = async ({ context, event, func, timeout }) => {
  // If a function builder has defined a `buildPath` property, we use it.
  // Otherwise, we'll invoke the function's main file.
  const lambdaPath = (func.buildData && func.buildData.buildPath) || func.mainFile
  const { body, statusCode } = await lambdaLocal.execute({
    clientContext: context,
    event,
    lambdaPath,
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
    verboseLevel: 3,
  })

  return { body, statusCode }
}

module.exports = { getBuildFunction, invokeFunction, name: 'js' }
