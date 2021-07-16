const { statAsync } = require('../../lib/fs')
const { getPathInProject } = require('../../lib/settings')

const getFunctionsDir = ({ flags, config }, defaultValue) =>
  flags.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

const getInternalFunctionsDir = ({ verifyExistence = true } = {}) => {
  const path = getPathInProject(['functions-internal'])

  if (verifyExistence) {
    return getPathIfExists(path)
  }

  return path
}

const getPathIfExists = async (path) => {
  try {
    const stat = await statAsync(path)

    return stat.isDirectory() ? path : null
  } catch (_) {
    return null
  }
}

module.exports = { getFunctionsDir, getInternalFunctionsDir }
