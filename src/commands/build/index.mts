// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createBuil... Remove this comment to see the full error message
const { createBuildCommand } = require('./build.cjs')

module.exports = {
  createBuildCommand,
}
