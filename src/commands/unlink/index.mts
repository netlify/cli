// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createUnli... Remove this comment to see the full error message
const { createUnlinkCommand } = require('./unlink.cjs')

module.exports = {
  createUnlinkCommand,
}
