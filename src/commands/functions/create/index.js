const { Command, flags } = require('@oclif/command')

class SitesCreateCommand extends Command {
  async run() {
    this.log(`create a function locally`)
  }
}

SitesCreateCommand.description = `create a new function
`

SitesCreateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = SitesCreateCommand
