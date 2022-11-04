// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'sitesCreat... Remove this comment to see the full error message
const { sitesCreate } = require('./sites-create.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const { createSitesCommand } = require('./sites.cjs')

module.exports = {
  createSitesCommand,
  sitesCreate,
}
