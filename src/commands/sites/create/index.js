const { Command, flags } = require('@oclif/command')

class SitesCreateCommand extends Command {
  async run() {
    this.log(`create a site`)
  }
}

SitesCreateCommand.description = `create a site
...
Extra documentation goes here
`

SitesCreateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = SitesCreateCommand
