// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dotProp'.
const dotProp = require('dot-prop')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const supportsBooleanCapability = (account: $TSFixMe, capability: $TSFixMe) => dotProp.get(account, `capabilities.${capability}.included`)

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const supportsEdgeHandlers = (account: $TSFixMe) => supportsBooleanCapability(account, 'edge_handlers')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'supportsBa... Remove this comment to see the full error message
const supportsBackgroundFunctions = (account: $TSFixMe) => supportsBooleanCapability(account, 'background_functions')

module.exports = {
  supportsBackgroundFunctions,
  supportsEdgeHandlers,
}
