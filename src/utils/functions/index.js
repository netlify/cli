const getFunctionsDir = ({ flags, config }, defaultValue) =>
  flags.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

module.exports = { getFunctionsDir }
