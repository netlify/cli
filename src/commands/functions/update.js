const { Command, flags } = require('@oclif/command')

class FunctionsUpdateCommand extends Command {
  async run() {
    this.log(`update a function`)
  }
}

FunctionsUpdateCommand.description = `update a function
...
Extra documentation goes here
`

FunctionsUpdateCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

// TODO make visible once implementation complete
FunctionsUpdateCommand.hidden = true

module.exports = FunctionsUpdateCommand
