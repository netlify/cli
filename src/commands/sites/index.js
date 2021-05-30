const { isEmptyCommand } = require('../../utils/check-command-inputs')
const showHelp = require('../../utils/show-help')
const { TrackedCommand } = require('../../utils/telemetry/tracked-command')

class SitesCommand extends TrackedCommand {
  run() {
    const { flags, args } = this.parse(SitesCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
    }
  }
}

SitesCommand.description = `Handle various site operations
The sites command will help you manage all your sites
`

SitesCommand.examples = ['netlify sites:create --name my-new-site', 'netlify sites:list']

module.exports = SitesCommand
