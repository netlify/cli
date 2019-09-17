module.exports.requiredConfigValues = function requiredConfigValues(config) {
  return Object.keys(config).filter(key => {
    return config[key].required
  })
}

module.exports.missingConfigValues = function missingConfigValues(requiredConfig, providedConfig) {
  return requiredConfig.filter(key => {
    return !providedConfig[key]
  })
}

module.exports.updateConfigValues = function missingConfigValues(allowedConfig, currentConfig, newConfig) {
  return Object.keys(allowedConfig).reduce((acc, key) => {
    if (newConfig[key]) {
      acc[key] = newConfig[key]
      return acc
    }
    acc[key] = currentConfig[key]
    return acc
  }, {})
}
