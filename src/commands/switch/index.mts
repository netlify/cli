// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSwit... Remove this comment to see the full error message
const { createSwitchCommand } = require('./switch.cjs')

module.exports = {
  createSwitchCommand,
}
