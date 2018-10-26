const { Command } = require('@oclif/command')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

class SitesCommand extends Command {
  async run() {
    const { flags, args } = this.parse(SitesCommand) // { args: {}, argv: [], flags: {}, raw: [] }

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }
  }
}

SitesCommand.description = `Handle various site operations
The sites command will help you manage all your sites
`

SitesCommand.examples = [
  'netlify sites:create --name my-new-site',
  //'netlify sites:update --name my-new-site',
  //'netlify sites:delete --name my-new-site',
  'netlify sites:list'
]

module.exports = SitesCommand
