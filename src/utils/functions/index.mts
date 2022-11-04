// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'edgeFuncti... Remove this comment to see the full error message
const edgeFunctions = require('../../lib/edge-functions/index.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'constants'... Remove this comment to see the full error message
const constants = require('./constants.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'functions'... Remove this comment to see the full error message
const functions = require('./functions.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getFunctio... Remove this comment to see the full error message
const getFunctions = require('./get-functions.cjs')

module.exports = {
  ...constants,
  ...functions,
  ...edgeFunctions,
  ...getFunctions,
}
