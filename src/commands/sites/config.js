const { Command, flags } = require('@oclif/command')

class SitesConfigCommand extends Command {
  async run() {
    this.log(`update a site`)
    this.log(`Implementation coming soon`)

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'sites:config',
      },
    })

    // TODO handle repo URL updates
  }
}

SitesConfigCommand.description = `update a site
...
Extra documentation goes here
`

SitesConfigCommand.flags = {
  name: flags.string({
    char: 'n',
    description: 'name to print',
  }),
}

// TODO implement logic
SitesConfigCommand.hidden = true

module.exports = SitesConfigCommand
