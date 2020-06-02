const { Command } = require('@oclif/command')
const showHelp = require('../../utils/show-help')
const { isEmptyCommand } = require('../../utils/check-command-inputs')

class SitesCommand extends Command {
  async run() {
    const { flags, args } = this.parse(SitesCommand) // { args: {}, argv: [], flags: {}, raw: [] }

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'sites',
      },
    })
  }
}

SitesCommand.description = `Handle various site operations
The sites command will help you manage all your sites
`

SitesCommand.examples = [
  'netlify sites:create --name my-new-site',
  //'netlify sites:update --name my-new-site',
  //'netlify sites:delete --name my-new-site',
  'netlify sites:list',
]

module.exports = SitesCommand
