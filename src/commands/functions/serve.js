const { Command, flags } = require('@oclif/command')

class FunctionsServeCommand extends Command {
  async run() {
    this.log(`serve a function`)
  }
}

FunctionsServeCommand.description = `serve functions locally for dev
...
Extra documentation goes here
`

FunctionsServeCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

// TODO make visible once implementation complete
FunctionsServeCommand.hidden = true

module.exports = FunctionsServeCommand
