const { Command, flags } = require('@oclif/command')

class FunctionsCreateCommand extends Command {
  async run() {
    this.log(`scaffold out a new function locally`)
  }
}

FunctionsCreateCommand.description = `create a new function locally
`

FunctionsCreateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = FunctionsCreateCommand
