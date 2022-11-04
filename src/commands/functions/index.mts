// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const { createFunctionsCommand } = require('./functions.cjs')

module.exports = {
  createFunctionsCommand,
}
