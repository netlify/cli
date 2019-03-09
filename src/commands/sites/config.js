const { Command, flags } = require('@oclif/command')

class SitesConfigCommand extends Command {
  async run() {
    this.log(`update a site`)
    this.log(`Implementation coming soon`)

    // TODO handle repo URL updates
  }
}

SitesConfigCommand.description = `update a site
...
Extra documentation goes here
`

SitesConfigCommand.flags = Object.assign(
  {
    name: flags.string({
      char: 'n',
      description: 'name to print'
    })
  },
  Command.flags
)

// TODO implement logic
SitesConfigCommand.hidden = true

module.exports = SitesConfigCommand
