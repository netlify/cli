const { isEmptyCommand } = require('../../utils/check-command-inputs')
const Command = require('../../utils/command')
const showHelp = require('../../utils/show-help')
const { track } = require('../../utils/telemetry')

class LmCommand extends Command {
  async run() {
    const { flags, args } = this.parse(LmCommand)

    await track('command', {
      command: 'lm',
    })

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
