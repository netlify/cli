// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmCo... Remove this comment to see the full error message
const { createLmCommand } = require('./lm.cjs')

module.exports = {
  createLmCommand,
}
