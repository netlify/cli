// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'requiredCo... Remove this comment to see the full error message
const requiredConfigValues = function (config: $TSFixMe) {
  return Object.keys(config).filter((key) => config[key].required)
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'missingCon... Remove this comment to see the full error message
const missingConfigValues = function (requiredConfig: $TSFixMe, providedConfig: $TSFixMe) {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return requiredConfig.filter((key: $TSFixMe) => !providedConfig[key]);
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'updateConf... Remove this comment to see the full error message
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

module.exports = {
  requiredConfigValues,
  missingConfigValues,
  updateConfigValues,
}
