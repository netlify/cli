const dotProp = require('dot-prop')

const supportsBooleanCapability = (account, capability) => {
  return dotProp.get(account, `capabilities.${capability}.included`)
}

const supportsEdgeHandlers = (account) => {
  return supportsBooleanCapability(account, 'edge_handlers')
}

const supportsBackgroundFunctions = (account) => {
  return supportsBooleanCapability(account, 'background_functions')
}

module.exports = {
  supportsBackgroundFunctions,
  supportsEdgeHandlers,
}
