// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createComp... Remove this comment to see the full error message
const { createCompletionCommand } = require('./completion.cjs')

module.exports = {
  createCompletionCommand,
}
