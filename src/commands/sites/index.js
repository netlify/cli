const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')

class SitesCommand extends Command {
  async run() {
    const { flags, args } = this.parse(SitesCommand) // { args: {}, argv: [], flags: {}, raw: [] }

    // Show help on empty sub command
    if (emptyCommand(flags, args)) {
      // run help command if no args passed
      await SitesCommand.run(['--help'])
      this.exit()
    }
  }
}

function emptyCommand(flags, args) {
  const hasFlags = Object.keys(flags).length
  const hasArgs = Object.keys(args).length
  if (!hasFlags && !hasArgs) {
    return true
  }
  return false
}

SitesCommand.description = `${renderShortDesc('Handle site operations')}
The sites command will help you manage all your sites
`

SitesCommand.examples = [
  '$ netlify sites:create --name my-new-site',
  '$ netlify sites:update --name my-new-site',
  '$ netlify sites:delete --name my-new-site',
  '$ netlify sites:list'
]

module.exports = SitesCommand
