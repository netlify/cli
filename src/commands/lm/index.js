const { isEmptyCommand } = require('../../utils/check-command-inputs')
const Command = require('../../utils/command')
const showHelp = require('../../utils/show-help')

class LmCommand extends Command {
  run() {
    const { args, flags } = this.parse(LmCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
    }
  }
}

LmCommand.description = `Handle Netlify Large Media operations
The lm command will help you manage large media for a site
`
LmCommand.examples = ['netlify lm:info', 'netlify lm:install', 'netlify lm:setup']

module.exports = LmCommand
