// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAuto... Remove this comment to see the full error message
const { createAutocompletion } = require('./generate-autocompletion.cjs')

module.exports = {
  createAutocompletion,
}
