const { Command, flags } = require('@oclif/command')
const global = require('./utils/global-config')
const SiteConfig = require('./utils/site-config')

class BaseCommand extends Command {
  constructor({ auth = true }) {
    super()
    this.globalConfig = global
    this.siteConfig = new SiteConfig(process.cwd())
  }
}

module.exports = BaseCommand
