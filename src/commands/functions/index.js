const chalk = require('chalk')
const { Command } = require('@oclif/command')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

class FunctionsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(FunctionsCommand)
    // run help command if no args passed
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }
  }
}

const name = chalk.greenBright(`\`functions\``)

FunctionsCommand.description = `Manage netlify functions
The ${name} command will help you manage the functions in this site
`
FunctionsCommand.examples = [
  'netlify functions:create --name function-xyz --runtime nodejs',
  'netlify functions:update --name function-abc --timeout 30s'
]

// TODO make visible once implementation complete
FunctionsCommand.hidden = true

module.exports = FunctionsCommand
