const { Command, flags } = require('@oclif/command')

class FunctionsCreateCommand extends Command {
  async run() {
    this.log(`create a function locally`)
  }
}

FunctionsCreateCommand.description = `create a new function
`

FunctionsCreateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = FunctionsCreateCommand
