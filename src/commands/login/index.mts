// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLogi... Remove this comment to see the full error message
const { createLoginCommand, login } = require('./login.cjs')

module.exports = {
  createLoginCommand,
  login,
}
