const { getPathInProject } = require('../../lib/settings')

const getFunctionsDir = ({ flags, config }, defaultValue) =>
  flags.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

const getInternalFunctionsDir = () => getPathInProject(['functions-internal'])

module.exports = { getFunctionsDir, getInternalFunctionsDir }
