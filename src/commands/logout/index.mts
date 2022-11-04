// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLogo... Remove this comment to see the full error message
const { createLogoutCommand } = require('./logout.cjs')

module.exports = {
  createLogoutCommand,
}
