const { isDirectoryAsync } = require('../../lib/fs')
const { getPathInProject } = require('../../lib/settings')

const getFunctionsDir = ({ flags, config }, defaultValue) =>
  flags.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

const getInternalFunctionsDir = async () => {
  const path = getPathInProject(['functions-internal'])
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}

module.exports = { getFunctionsDir, getInternalFunctionsDir }
