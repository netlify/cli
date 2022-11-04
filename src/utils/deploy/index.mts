// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'deploySite... Remove this comment to see the full error message
const { deploySite } = require('./deploy-site.cjs')

module.exports = { deploySite }
