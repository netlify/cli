// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createDepl... Remove this comment to see the full error message
const { createDeployCommand } = require('./deploy.cjs')

module.exports = {
  createDeployCommand,
}
