const { statAsync } = require('../../lib/fs')
const { getPathInProject } = require('../../lib/settings')

const getFunctionsDir = ({ flags, config }, defaultValue) =>
  flags.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

const getInternalFunctionsDir = async () => {
  const path = getPathInProject(['functions-internal'])

  try {
    const stat = await statAsync(path)

    return stat.isDirectory() ? path : null
  } catch (_) {
    return null
  }
}

module.exports = { getFunctionsDir, getInternalFunctionsDir }
