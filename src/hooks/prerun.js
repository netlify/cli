const header = require('../utils/header')
const global = require('../utils/global-config')
const SiteConfig = require('../utils/site-config')

module.exports = async context => {
  header(context)
  context.config.global = global
  context.config.site = new SiteConfig(process.cwd())
}
