// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createDevC... Remove this comment to see the full error message
const { createDevCommand } = require('./dev.cjs')

module.exports = {
  createDevCommand,
}
