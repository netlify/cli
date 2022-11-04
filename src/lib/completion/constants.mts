// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInH... Remove this comment to see the full error message
const { getPathInHome } = require('../settings.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AUTOCOMPLE... Remove this comment to see the full error message
const AUTOCOMPLETION_FILE = getPathInHome(['autocompletion.json'])

module.exports = { AUTOCOMPLETION_FILE }
