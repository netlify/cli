const lambdaLocal = require('lambda-local')

const invokeFunction = async ({ context, event, mainFile, timeout }) => {
  const { body, statusCode } = await lambdaLocal.execute({
    clientContext: context,
    event,
    lambdaPath: mainFile,
    timeoutMs: timeout,
    verboseLevel: 3,
  })

  return { body, statusCode }
}

module.exports = { invokeFunction }
