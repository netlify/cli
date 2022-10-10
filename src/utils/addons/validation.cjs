const requiredConfigValues = function (config) {
  return Object.keys(config).filter((key) => config[key].required)
}

const missingConfigValues = function (requiredConfig, providedConfig) {
  return requiredConfig.filter((key) => !providedConfig[key])
}

const updateConfigValues = function (allowedConfig, currentConfig, newConfig) {
  return Object.keys(allowedConfig).reduce((acc, key) => {
    if (newConfig[key]) {
      acc[key] = newConfig[key]
      return acc
    }
    acc[key] = currentConfig[key]
    return acc
  }, {})
}

module.exports = {
  requiredConfigValues,
  missingConfigValues,
  updateConfigValues,
}
