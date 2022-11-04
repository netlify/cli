// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const { createAddonsCommand } = require('./addons.cjs')

module.exports = {
  createAddonsCommand,
}
