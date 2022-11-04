// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createInit... Remove this comment to see the full error message
const { createInitCommand, init } = require('./init.cjs')

module.exports = {
  createInitCommand,
  init,
}
