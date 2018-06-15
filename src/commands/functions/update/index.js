const { Command, flags } = require('@oclif/command')

class SitesUpdateCommand extends Command {
  async run() {
    this.log(`update a function`)
  }
}

SitesUpdateCommand.description = `update a function
...
Extra documentation goes here
`

SitesUpdateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = SitesUpdateCommand
