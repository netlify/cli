// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvC... Remove this comment to see the full error message
const { createEnvCommand } = require('./env.cjs')

module.exports = {
  createEnvCommand,
}
