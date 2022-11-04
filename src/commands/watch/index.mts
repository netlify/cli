// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createWatc... Remove this comment to see the full error message
const { createWatchCommand } = require('./watch.cjs')

module.exports = {
  createWatchCommand,
}
