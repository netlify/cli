// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createApiC... Remove this comment to see the full error message
const { createApiCommand } = require('./api.cjs')

module.exports = {
  createApiCommand,
}
