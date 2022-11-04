// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createOpen... Remove this comment to see the full error message
const { createOpenCommand } = require('./open.cjs')

module.exports = {
  createOpenCommand,
}
