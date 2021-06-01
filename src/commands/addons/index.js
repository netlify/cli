const { isEmptyCommand } = require('../../utils/check-command-inputs')
const showHelp = require('../../utils/show-help')
const { TrackedCommand } = require('../../utils/telemetry/tracked-command')

class AddonsCommand extends TrackedCommand {
  run() {
    const { flags, args } = this.parse(AddonsCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
    }
  }
}

AddonsCommand.description = `(Beta) Manage Netlify Add-ons`
AddonsCommand.aliases = ['addon']
AddonsCommand.examples = [
  'netlify addons:create addon-xyz',
  'netlify addons:list',
  'netlify addons:config addon-xyz',
  'netlify addons:delete addon-xyz',
  'netlify addons:auth addon-xyz',
]

module.exports = AddonsCommand
