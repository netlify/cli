const { isEmptyCommand } = require('../../utils/check-command-inputs')
const Command = require('../../utils/command')
const showHelp = require('../../utils/show-help')

class LmCommand extends Command {
  async run() {
    const { flags, args } = this.parse(LmCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'lm',
      },
    })
  }
}

LmCommand.description = `Handle Netlify Large Media operations
The lm command will help you manage large media for a site
`
LmCommand.examples = ['netlify lm:info', 'netlify lm:install', 'netlify lm:setup']

module.exports = LmCommand
