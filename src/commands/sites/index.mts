const { sitesCreate } = require('./sites-create.cjs')
const { createSitesCommand } = require('./sites.cjs')

module.exports = {
  createSitesCommand,
  sitesCreate,
}
