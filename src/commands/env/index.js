const Command = require('../../utils/command')
const showHelp = require('../../utils/show-help')
const { isEmptyCommand } = require('../../utils/check-command-inputs')

class EnvCommand extends Command {
  async run() {
    const { flags, args } = this.parse(EnvCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'env',
      },
    })
  }
}

EnvCommand.description = `(Beta) Control environment variables for the current site`
EnvCommand.examples = [
  'netlify env:list',
  'netlify env:get VAR_NAME',
  'netlify env:set VAR_NAME value',
  'netlify env:unset VAR_NAME',
  'netlify env:import fileName',
]

module.exports = EnvCommand
