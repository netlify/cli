const dotProp = require('dot-prop')

const supportsBooleanCapability = (account, capability) => dotProp.get(account, `capabilities.${capability}.included`)

const supportsEdgeHandlers = (account) => supportsBooleanCapability(account, 'edge_handlers')

const supportsBackgroundFunctions = (account) => supportsBooleanCapability(account, 'background_functions')

module.exports = {
  supportsBackgroundFunctions,
  supportsEdgeHandlers,
}
