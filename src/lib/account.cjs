const dotProp = require('dot-prop')

const supportsBooleanCapability = (account, capability) => dotProp.get(account, `capabilities.${capability}.included`)

const supportsBackgroundFunctions = (account) => supportsBooleanCapability(account, 'background_functions')

module.exports = {
  supportsBackgroundFunctions,
}
