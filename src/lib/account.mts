
const dotProp = require('dot-prop')


const supportsBooleanCapability = (account: $TSFixMe, capability: $TSFixMe) => dotProp.get(account, `capabilities.${capability}.included`)


const supportsEdgeHandlers = (account: $TSFixMe) => supportsBooleanCapability(account, 'edge_handlers')


const supportsBackgroundFunctions = (account: $TSFixMe) => supportsBooleanCapability(account, 'background_functions')

module.exports = {
  supportsBackgroundFunctions,
  supportsEdgeHandlers,
}
