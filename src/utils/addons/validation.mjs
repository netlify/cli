export const requiredConfigValues = function (config) {
  return Object.keys(config).filter((key) => config[key].required)
}

export const missingConfigValues = function (requiredConfig, providedConfig) {
  return requiredConfig.filter((key) => !providedConfig[key])
}

export const updateConfigValues = function (allowedConfig, currentConfig, newConfig) {
  return Object.keys(allowedConfig).reduce((acc, key) => {
    if (newConfig[key]) {
      acc[key] = newConfig[key]
      return acc
    }
    acc[key] = currentConfig[key]
    return acc
  }, {})
}
