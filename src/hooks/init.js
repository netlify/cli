const header = require('../utils/header')
const global = require('../utils/global-config')
const site = require('../utils/site-config')

module.exports = init
async function init(context) {
  // set up config properties
  this.globalConfig = global
  this.siteConfig = site(process.cwd())

  header(context)
}
