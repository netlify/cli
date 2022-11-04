
const requiredConfigValues = function (config: $TSFixMe) {
  return Object.keys(config).filter((key) => config[key].required)
}


const missingConfigValues = function (requiredConfig: $TSFixMe, providedConfig: $TSFixMe) {
  
  return requiredConfig.filter((key: $TSFixMe) => !providedConfig[key]);
}


const updateConfigValues = function (allowedConfig: $TSFixMe, currentConfig: $TSFixMe, newConfig: $TSFixMe) {
  return Object.keys(allowedConfig).reduce((acc, key) => {
    if (newConfig[key]) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[key] = newConfig[key]
      return acc
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[key] = currentConfig[key]
    return acc
  }, {})
}

export default {
  requiredConfigValues,
  missingConfigValues,
  updateConfigValues,
}
