import dotProp from 'dot-prop'

const supportsBooleanCapability = (account, capability) => dotProp.get(account, `capabilities.${capability}.included`)

export const supportsEdgeHandlers = (account) => supportsBooleanCapability(account, 'edge_handlers')

export const supportsBackgroundFunctions = (account) => supportsBooleanCapability(account, 'background_functions')
