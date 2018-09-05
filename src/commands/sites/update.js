const { Command, flags } = require('@oclif/command')

class SitesUpdateCommand extends Command {
  async run() {
    this.log(`update a site`)
    this.log(`Implementation coming soon`)
  }
}

SitesUpdateCommand.description = `update a site
...
Extra documentation goes here
`

SitesUpdateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

// TODO implement logic
SitesUpdateCommand.hidden = true

module.exports = SitesUpdateCommand
